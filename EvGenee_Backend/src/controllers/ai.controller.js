const { processVoiceChat } = require("../services/langgraph.service");
const { v4: uuidv4 } = require("uuid");

const handleVoiceChat = async (req, res) => {
  try {
    const { message, threadId } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: "Message is required" });
    }

  
    const currentThreadId = threadId || uuidv4();

   
    const aiResponse = await processVoiceChat(message, currentThreadId);

    res.status(200).json({
      success: true,
      data: {
        response: aiResponse,
        threadId: currentThreadId
      }
    });
  } catch (error) {
    console.error("Error in handleVoiceChat:", error);
    res.status(500).json({ success: false, error: "Internal server error processing voice chat" });
  }
};

module.exports = {
  handleVoiceChat,
};
