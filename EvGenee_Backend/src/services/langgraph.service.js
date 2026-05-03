const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { ChatGroq } = require("@langchain/groq");
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { MemorySaver } = require("@langchain/langgraph");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const Station = require("../models/station.model");
const Booking = require("../models/booking.model");
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
      if (!coords) return `I couldn't locate "${location}" on the map. Could you specify a more precise city or area?`;

      const stations = await Station.find({
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: coords },
            $maxDistance: 40000 // 40km
          }
        },
        isOpen: true,
        typeOfConnectors: chargerType
      }).limit(5);

      if (stations.length === 0) {
        return `I couldn't find any open charging stations within 40km of ${location} that support ${chargerType} connectors.`;
      }

      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0);

      let result = "";
      let foundAvailable = false;

      for (const st of stations) {
    
        const bookings = await Booking.find({
          station: st._id,
          date: queryDate,
          status: { $in: ['pending', 'confirmed', 'in-progress'] },
          connectorType: chargerType
        });

      
        let overlapping = 0;
        for (const b of bookings) {
          if (isOverlapping(startTime, endTime, b.startTime, b.endTime)) {
            overlapping++;
          }
        }

        if (overlapping < st.availablePorts) {
          result += ` ${st.name} in ${st.address.city} is AVAILABLE from ${startTime} to ${endTime}.\n`;
          foundAvailable = true;
          break; 
        } else {
          // Find alternative slots (e.g. shift by 1 hour forward or backward)
          result += ` ${st.name} is FULLY BOOKED at that time. `;
          
        
          const reqStartMins = timeToMinutes(startTime);
          const duration = timeToMinutes(endTime) - reqStartMins;
          
          let altFound = false;
          
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

      if (!foundAvailable) {
        result = "None of the nearby stations are available at your exact requested time. " + result;
      }

      return result + "\nWould you like me to book one of these available slots for you?";
    } catch (err) {
      console.error("Tool Error:", err);
      return `Sorry, I encountered an error while searching for stations: ${err.message}`;
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

const systemPrompt = new SystemMessage(`You are EvGenee, a helpful, polite, and efficient voice assistant for EV Charging Station bookings.

CRITICAL INSTRUCTIONS:
Before you search for any stations, you MUST ensure you have clarified the following 5 pieces of information from the user:
1. Location (e.g., Delhi, Connaught Place)
2. Date (e.g., '2024-05-02', 'tomorrow')
3. Start Time (convert to 24-hour HH:MM format)
4. End Time or Duration (convert to an exact End Time in 24-hour HH:MM format. e.g. if they say "for 2 hours starting at 10 AM", End Time is "12:00")
5. Charger Type (e.g., CCS2, Type2, CHAdeMO, Tesla)

If ANY of these are missing, DO NOT call any tools. Instead, ask the user clarifying questions naturally.
Once you have all 5 pieces of information, call the 'find_best_station' tool.
If the tool says a station is fully booked but recommends an alternative time, relay that alternative time to the user naturally.
Be concise and conversational. Do not use markdown formatting like asterisks or bullet points in your final spoken response.`);

function createVoiceAgent() {
  const llm = new ChatGroq({
    modelName: "llama-3.1-70b-versatile", 
    temperature: 0.1,
  });

  const tools = [findBestStationTool];

  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
    messageModifier: systemPrompt,
  });

  return agent;
}

const voiceAgent = createVoiceAgent();

async function processVoiceChat(message, threadId) {
  try {
    const response = await voiceAgent.invoke(
      { messages: [new HumanMessage(message)] },
      { configurable: { thread_id: threadId } }
    );

    const aiMessages = response.messages.filter(m => m._getType() === "ai");
    const lastMessage = aiMessages[aiMessages.length - 1];

    return lastMessage.content;
  } catch (error) {
    console.error("LangGraph Agent Error:", error);
    throw new Error("Failed to process message through LangGraph agent");
  }
}

module.exports = {
  processVoiceChat,
};
