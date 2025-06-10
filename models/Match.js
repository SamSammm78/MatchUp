const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Créateur du match
  location: { type: String, required: true }, // Lieu du match
  date: { type: Date, required: true }, // Date et heure du match
  maxPlayers: { type: Number, required: true }, // Nombre maximum de joueurs
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Joueurs inscrits
  notes: { type: String }, // Notes ou infos supplémentaires
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', MatchSchema);
