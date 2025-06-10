const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username:  { type: String, required: true, unique: true },
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  level:     { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Intermediate' },
  position:  { type: String, enum: ['GK', 'DEF', 'MID', 'ATT'], default: 'MID' },
  
  // ✅ Réseaux sociaux
  socialLinks: {
    instagram: { type: String },
    snapchat:  { type: String },
    whatsapp:  { type: String },
    phone:     { type: String }, // pour contact direct
  },

  stats: {
    matchesPlayed: { type: Number, default: 0 },
    goals:         { type: Number, default: 0 },
    assists:       { type: Number, default: 0 },
  },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
