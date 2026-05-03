const express = require("express");
const { handleVoiceChat } = require("../controllers/ai.controller");
const router = express.Router();

router.post("/chat", handleVoiceChat);

module.exports = router;
