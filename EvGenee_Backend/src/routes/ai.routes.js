const express = require("express");
const { handleVoiceChat } = require("../controllers/ai.controller");
const { validateToken } = require("../middlewares/auth.middleware");
const router = express.Router();

router.post("/chat", validateToken, handleVoiceChat);

module.exports = router;
