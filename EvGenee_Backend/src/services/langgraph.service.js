const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { ChatGroq } = require("@langchain/groq");
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { MemorySaver } = require("@langchain/langgraph");
const { HumanMessage, SystemMessage, AIMessage } = require("@langchain/core/messages");
const Station = require("../models/station.model");
const Booking = require("../models/booking.model");
const MessageModel = require("../models/message.model");
const { GROQ_API_KEY, PLATFORM_FEE_PERCENTAGE } = require('../config/config');
const axios = require("axios");
const memory = new MemorySaver();

async function geocodeLocation(locationStr) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationStr)}&format=json&limit=1`;
    const response = await axios.get(url, { headers: { "User-Agent": "EvGenee_Bot" } });
    if (response.data && response.data.length > 0) {
      return [parseFloat(response.data[0].lon), parseFloat(response.data[0].lat)];
    }
    return null;
  } catch (err) {
    console.error("Geocoding error:", err.message);
    return null;
  }
}
async function getRoadDistance(startCoords, endCoords) {
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?overview=false`;
    const response = await axios.get(url);
    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      return {
        distanceKm: (route.distance / 1000).toFixed(2),
        durationMins: (route.duration / 60).toFixed(1)
      };
    }
    return null;
  } catch (err) {
    console.error("OSRM error:", err.message);
    return null;
  }
}

const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const isOverlapping = (startA, endA, startB, endB) => {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && sB < eA;
};

const findBestStationTool = tool(
  async ({ location, date, startTime, endTime, chargerType }) => {
    try {
      const coords = await geocodeLocation(location);
      if (!coords) return JSON.stringify({ error: `I couldn't locate "${location}" on the map. Could you specify a more precise city or area?` });

      const stations = await Station.find({
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: coords },
            $maxDistance: 400000
          }
        }
      }).limit(5);

      if (stations.length === 0) {
        return JSON.stringify({ error: `I couldn't find any charging stations within 40km of ${location}.` });
      }

      let queryDate = new Date(date);
      if (isNaN(queryDate.valueOf())) {
        queryDate = new Date(); 
      }
      queryDate.setHours(0, 0, 0, 0);
      let result = "";
      let foundAvailable = false;

      for (const st of stations) {

        if (!st.typeOfConnectors.includes(chargerType)) {
           result += ` ${st.name} in ${st.address.city} does NOT support ${chargerType} (Available: ${st.typeOfConnectors.join(', ')}).\n`;
           continue;
        }

        
        if (!st.isOpen) {
           result += ` ${st.name} in ${st.address.city} is currently CLOSED.\n`;
           continue;
        }

        const bookings = await Booking.find({
          station: st._id,
          date: queryDate,
          status: { $in: ['pending', 'confirmed', 'in-progress'] },
        });


        let overlapping = 0;
        for (const b of bookings) {
          if (isOverlapping(startTime, endTime, b.startTime, b.endTime)) {
            overlapping++;
          }
        }

        if (overlapping < st.availablePorts) {
          const roadInfo = await getRoadDistance(coords, st.location.coordinates);
          let distanceStr = "";
          if (roadInfo) {
            distanceStr = ` (approx. ${roadInfo.distanceKm} KM, ${roadInfo.durationMins} mins away by road)`;
          }
          result += ` ${st.name}${distanceStr} in ${st.address.city} is AVAILABLE from ${startTime} to ${endTime}.\n`;
          foundAvailable = true;
          break;
        } else {
          
          result += `${st.name} is FULLY BOOKED at that time. `;


          const reqStartMins = timeToMinutes(startTime);
          const duration = timeToMinutes(endTime) - reqStartMins;

          let altFound = false;
      // i am finding alt hour
          for (let offset = 60; offset <= 240; offset += 60) {
            const altStartMins = reqStartMins + offset;
            const altEndMins = altStartMins + duration;

            if (altStartMins >= 24 * 60 || altEndMins >= 24 * 60) continue;

            const altStart = `${Math.floor(altStartMins / 60).toString().padStart(2, '0')}:${(altStartMins % 60).toString().padStart(2, '0')}`;
            const altEnd = `${Math.floor(altEndMins / 60).toString().padStart(2, '0')}:${(altEndMins % 60).toString().padStart(2, '0')}`;

            let altOverlapping = 0;
            for (const b of bookings) {
              if (isOverlapping(altStart, altEnd, b.startTime, b.endTime)) altOverlapping++;
            }

            if (altOverlapping < st.availablePorts) {
              result += `However, it is AVAILABLE later from ${altStart} to ${altEnd}.\n`;
              altFound = true;
              break;
            }
          }
          if (!altFound) result += `No nearby slots available either.\n`;
        }
      }

      const stationsData = await Promise.all(stations.map(async (st) => {
        const roadInfo = await getRoadDistance(coords, st.location.coordinates);
        return {
          id: st._id,
          name: st.name,
          city: st.address.city,
          isOpen: st.isOpen,
          totalPorts: st.totalPorts,
          availablePorts: st.availablePorts,
          chargerTypes: st.typeOfConnectors,
          chargingSpeed: st.chargingSpeed,
          pricing: st.pricing,
          isCompatible: st.typeOfConnectors.includes(chargerType),
          roadDistance: roadInfo ? roadInfo.distanceKm : null,
          travelTime: roadInfo ? roadInfo.durationMins : null
        };
      }));

      return JSON.stringify({
        text: result + (foundAvailable ? "\nWould you like me to book one of these available slots for you?" : ""),
        stations: stationsData,
        foundAvailable
      });
    } catch (err) {
      console.error("Tool Error:", err);
      return JSON.stringify({ error: `Sorry, I encountered an error while searching for stations: ${err.message}` });
    }
  },
  {
    name: "find_best_station",
    description: "Searches for EV charging stations and rigorously checks port availability against active bookings.",
    schema: z.object({
      location: z.string().describe("The city, area, or address to search near"),
      date: z.string().describe("The exact date for the booking (e.g., '2024-05-02')"),
      startTime: z.string().describe("The start time in 24-hour HH:MM format (e.g., '10:00')"),
      endTime: z.string().describe("The end time in 24-hour HH:MM format (e.g., '12:00')"),
      chargerType: z.string().describe("The type of EV connector, e.g., 'CCS2', 'Type2', 'CHAdeMO'"),
    })
  }
);

const createBookingTool = (userInfo) => tool(
  async ({ stationId, date, startTime, endTime, chargerType }) => {
    try {
      const station = await Station.findById(stationId);
      if (!station) return JSON.stringify({ error: "Station not found." });

      let bookingDate = new Date(date);
      if (isNaN(bookingDate.valueOf())) {
        bookingDate = new Date(); 
      }
      bookingDate.setHours(0, 0, 0, 0);

      const requestedStart = timeToMinutes(startTime);
      const requestedEnd = timeToMinutes(endTime);
      const durationMinutes = requestedEnd - requestedStart;

      
      const existingBookings = await Booking.find({
        station: stationId,
        date: bookingDate,
        status: { $in: ['pending', 'confirmed', 'in-progress'] },
      });
      
      let overlapping = 0;
      for (const b of existingBookings) {
        if (isOverlapping(startTime, endTime, b.startTime, b.endTime)) {
          overlapping++;
        }
      }
      
      if (overlapping >= station.availablePorts) {
        return JSON.stringify({ error: "Conflict detected: This slot is no longer available. Please try another time." });
      }

      const pricing = station.pricing.find((p) => p.connectorType === chargerType);
      const pricePerKWh = pricing ? pricing.priceperKWh : 0;
      const durationHours = durationMinutes / 60;
      const estimatedKWh = parseFloat((station.chargingSpeed * durationHours).toFixed(2));
      const totalCost = parseFloat((estimatedKWh * pricePerKWh).toFixed(2));

      const platformFeePercentage = PLATFORM_FEE_PERCENTAGE;
      const platformFee = parseFloat(((totalCost * platformFeePercentage) / 100).toFixed(2));
      const grandTotal = parseFloat((totalCost + platformFee).toFixed(2));

      const booking = await Booking.create({
        user: userInfo.userId,
        station: stationId,
        connectorType: chargerType,
        date: bookingDate,
        startTime,
        endTime,
        durationMinutes,
        estimatedKWh,
        totalCost,
        platformFee,
        grandTotal,
        status: 'pending',
      });

      return JSON.stringify({
        success: true,
        bookingId: booking._id,
        message: "Booking is pending. User must pay advance within 10 minutes."
      });
    } catch (err) {
      console.error("Booking Tool Error:", err);
      return `Failed to create booking: ${err.message}`;
    }
  },
  {
    name: "create_booking",
    description: "Creates a formal booking in the system after the user confirms a specific slot and station.",
    schema: z.object({
      stationId: z.string().describe("The ID of the station to book"),
      date: z.string().describe("The date of booking"),
      startTime: z.string().describe("Start time HH:MM"),
      endTime: z.string().describe("End time HH:MM"),
      chargerType: z.string().describe("The connector type"),
    })
  }
);

const getSystemPrompt = () => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US');
  
  return new SystemMessage(`You are EvGenee, a helpful, polite, and efficient voice assistant for EV Charging Station bookings.

CRITICAL CONTEXT:
Today is ${dateStr}. The current time is ${timeStr}.
Do not allow users to book time slots that have already passed today or dates in the past. If they ask for "today" or a time that has already passed, politely inform them and ask for a valid future time.

FLOW:
1. GATHER: Ensure you have Location, Date, Start Time, End Time/Duration, and Charger Type. Ask clarifying questions naturally.
2. SEARCH: Once you have all 5, call 'find_best_station'.
3. SUGGEST: Suggest the available station(s) found. Mention name and city.
4. CONFIRM & BOOK: If the user says "Yes", "Confirm", or "Book it", call 'create_booking' using the stationId and details from the search results.
5. Do not provide long long answers and do not use special characters in your response. provide consise and perfect output also try to understand his/her intent.

CRITICAL INSTRUCTIONS:
- Do not use markdown (asterisks, etc.) in your final response.
- When 'create_booking' is successful, tell the user their booking is reserved (pending) and they MUST go to My Bookings and pay the advance within 10 minutes to confirm it, or it will be auto-cancelled.
- Be concise and friendly.`);
};

function createVoiceAgent(userInfo) {
  const llm = new ChatGroq({
    model: "openai/gpt-oss-20b",
    temperature: 0.1,
    apiKey: GROQ_API_KEY,
  });

  const tools = [findBestStationTool, createBookingTool(userInfo)];

  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
    messageModifier: getSystemPrompt(),
  });

  return agent;
}

async function processVoiceChat(message, threadId, userInfo) {
  try {
    const history = await MessageModel.find({ threadId }).sort({ createdAt: 1 });
    const formattedHistory = history.map(msg => {
      if (msg.role === 'user') return new HumanMessage(msg.content);
      return new AIMessage(msg.content);
    });

    await MessageModel.create({
      threadId,
      user: userInfo.userId,
      role: 'user',
      content: message
    });

    const voiceAgent = createVoiceAgent(userInfo);
    const messagesToInvoke = [...formattedHistory, new HumanMessage(message)];
    
    const response = await voiceAgent.invoke(
      { messages: messagesToInvoke },
      { configurable: { thread_id: threadId } }
    );

    const aiMessages = response.messages.filter(m => m._getType() === "ai");
    const lastMessage = aiMessages[aiMessages.length - 1];

    if (lastMessage && lastMessage.content) {
      await MessageModel.create({
        threadId,
        user: userInfo.userId,
        role: 'ai',
        content: lastMessage.content
      });
    }

    
    let bookingId = null;
    const toolMessages = response.messages.filter(m => m._getType() === "tool");
    for (const tm of toolMessages) {
      if (tm.content && (tm.content.startsWith('{') || tm.content.startsWith('['))) {
        try {
          const content = JSON.parse(tm.content);
          if (content.success && content.bookingId) {
            bookingId = content.bookingId;
          }
        } catch (e) {
          // Ignore parse errors for non-json tool outputs
        }
      }
    }

    if (bookingId) {
      return {
        response: lastMessage.content,
        bookingId: bookingId,
        redirect: true
      };
    }

   
    let stations = null;
    for (const tm of toolMessages) {
      if (tm.content && (tm.content.startsWith('{') || tm.content.startsWith('['))) {
        try {
          const content = JSON.parse(tm.content);
          if (content.stations) {
            stations = content.stations;
          }
        } catch (e) {}
      }
    }

    if (stations) {
      return {
        response: lastMessage.content,
        stations: stations
      };
    }

    return lastMessage.content;
  } catch (error) {
    console.error("LangGraph Agent Error:", error);
    throw new Error("Failed to process message through LangGraph agent");
  }
}

module.exports = {
  processVoiceChat,
};
