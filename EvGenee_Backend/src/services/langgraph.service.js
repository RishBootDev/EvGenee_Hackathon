const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { ChatGroq } = require("@langchain/groq");
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { MemorySaver } = require("@langchain/langgraph");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const Station = require("../models/station.model");
const Booking = require("../models/booking.model");
const PlatformSettings = require("../models/platformSettings.model");
const nodemailer = require('nodemailer');
const { NODEMAILER_USER, NODEMAILER_PASS, NODEMAILER_PORT } = require('../config/config');
const axios = require("axios");

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

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
            $maxDistance: 40000 
          }
        }
      }).limit(5);

      if (stations.length === 0) {
        return JSON.stringify({ error: `I couldn't find any charging stations within 40km of ${location}.` });
      }

      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0);

      let result = "";
      let foundAvailable = false;

      for (const st of stations) {
        // Check if station supports the charger type
        if (!st.typeOfConnectors.includes(chargerType)) {
           result += ` ${st.name} in ${st.address.city} does NOT support ${chargerType} (Available: ${st.typeOfConnectors.join(', ')}).\n`;
           continue;
        }

        // Check if open
        if (!st.isOpen) {
           result += ` ${st.name} in ${st.address.city} is currently CLOSED.\n`;
           continue;
        }

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
          result += ` ${st.name} (ID: ${st._id}) in ${st.address.city} is AVAILABLE from ${startTime} to ${endTime}.\n`;
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

      const stationsData = stations.map(st => ({
        id: st._id,
        name: st.name,
        city: st.address.city,
        isOpen: st.isOpen,
        totalPorts: st.totalPorts,
        availablePorts: st.availablePorts,
        chargerTypes: st.typeOfConnectors,
        chargingSpeed: st.chargingSpeed,
        pricing: st.pricing,
        isCompatible: st.typeOfConnectors.includes(chargerType)
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
  async ({ stationId, date, startTime, endTime, chargerType, vehicleNumber }) => {
    try {
      const station = await Station.findById(stationId);
      if (!station) return "Station not found.";

      const bookingDate = new Date(date);
      bookingDate.setHours(0, 0, 0, 0);

      const requestedStart = timeToMinutes(startTime);
      const requestedEnd = timeToMinutes(endTime);
      const durationMinutes = requestedEnd - requestedStart;

      // Re-validate availability to avoid conflict
      const existingBookings = await Booking.find({
        station: stationId,
        date: bookingDate,
        status: { $in: ['pending', 'confirmed', 'in-progress'] },
        connectorType: chargerType
      });
      
      let overlapping = 0;
      for (const b of existingBookings) {
        if (isOverlapping(startTime, endTime, b.startTime, b.endTime)) {
          overlapping++;
        }
      }
      
      if (overlapping >= station.availablePorts) {
        return "Conflict detected: This slot is no longer available. Please try another time.";
      }

      const pricing = station.pricing.find((p) => p.connectorType === chargerType);
      const pricePerKWh = pricing ? pricing.priceperKWh : 0;
      const durationHours = durationMinutes / 60;
      const estimatedKWh = parseFloat((station.chargingSpeed * durationHours).toFixed(2));
      const totalCost = parseFloat((estimatedKWh * pricePerKWh).toFixed(2));

      const settings = await PlatformSettings.findOne();
      const platformFeePercentage = settings ? settings.platformFee : 5;
      const platformFee = parseFloat(((totalCost * platformFeePercentage) / 100).toFixed(2));
      const grandTotal = parseFloat((totalCost + platformFee).toFixed(2));

      const otp = generateOtp();
      const otpExpiresAt = new Date(bookingDate);
      const [endH, endM] = endTime.split(':').map(Number);
      otpExpiresAt.setHours(endH, endM, 0, 0);

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
        vehicleNumber,
        status: 'confirmed',
        otp,
        otpExpiresAt,
      });

      const transporter = nodemailer.createTransport({
        secure: true,
        host: "smtp.gmail.com",
        port: NODEMAILER_PORT,
        auth: {
          user: NODEMAILER_USER,
          pass: NODEMAILER_PASS
        }
      });

      await transporter.sendMail({
        to: userInfo.email,
        subject: "Your EV Charging Booking OTP",
        html: `<p>Dear ${userInfo.name},</p>
        <p>Your booking for station <strong>${station.name}</strong> on <strong>${date}</strong> from <strong>${startTime}</strong> to <strong>${endTime}</strong> has been confirmed.</p>
        <p>Your OTP for check-in is: <strong>${otp}</strong></p>`
      });

      return JSON.stringify({
        success: true,
        bookingId: booking._id,
        message: "Booking created successfully. Redirecting to payment..."
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
      vehicleNumber: z.string().describe("The user's vehicle number/license plate"),
    })
  }
);

const systemPrompt = new SystemMessage(`You are EvGenee, a helpful, polite, and efficient voice assistant for EV Charging Station bookings.

FLOW:
1. GATHER: Ensure you have Location, Date, Start Time, End Time/Duration, Charger Type, AND Vehicle Number. Ask clarifying questions naturally if any of these 6 details are missing.
2. SEARCH: Once you have Location, Date, Start, End, and Charger Type, call 'find_best_station'.
3. SUGGEST: Suggest the available station(s) found. Mention name and city.
4. CONFIRM & BOOK: If the user says "Yes", "Confirm", or "Book it", ensure you have their Vehicle Number, then call 'create_booking' using the stationId and details from the search results.

CRITICAL INSTRUCTIONS:
- You must get the user's Vehicle Number before calling 'create_booking'.
- Do not use markdown (asterisks, etc.) in your final response.
- When 'create_booking' is successful, tell the user their booking is confirmed and they are being redirected to payment for the 20% advance.
- Be concise and friendly.`);

function createVoiceAgent(userInfo) {
  const llm = new ChatGroq({
    modelName: "llama-3.1-70b-versatile",
    temperature: 0.1,
  });

  const tools = [findBestStationTool, createBookingTool(userInfo)];

  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
    messageModifier: systemPrompt,
  });

  return agent;
}

async function processVoiceChat(message, threadId, userInfo) {
  try {
    const voiceAgent = createVoiceAgent(userInfo);
    const response = await voiceAgent.invoke(
      { messages: [new HumanMessage(message)] },
      { configurable: { thread_id: threadId } }
    );

    const aiMessages = response.messages.filter(m => m._getType() === "ai");
    const lastMessage = aiMessages[aiMessages.length - 1];

    // Check for bookingId in tool outputs
    let bookingId = null;
    const toolMessages = response.messages.filter(m => m._getType() === "tool");
    for (const tm of toolMessages) {
      try {
        const content = JSON.parse(tm.content);
        if (content.success && content.bookingId) {
          bookingId = content.bookingId;
        }
      } catch (e) {
        // Not JSON or not a booking response
      }
    }

    if (bookingId) {
      return {
        response: lastMessage.content,
        bookingId: bookingId,
        redirect: true
      };
    }

    // Check for station data in tool outputs
    let stations = null;
    for (const tm of toolMessages) {
      try {
        const content = JSON.parse(tm.content);
        if (content.stations) {
          stations = content.stations;
        }
      } catch (e) {}
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
