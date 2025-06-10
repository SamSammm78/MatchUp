const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs'); 

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
require('dotenv').config();
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));

// Connexion MongoDB Atlas
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connecté à MongoDB Atlas'))
.catch(err => console.error('❌ Erreur MongoDB :', err));

// Schéma User
const UserSchema = new mongoose.Schema({
  username:  { type: String, required: true, unique: true },
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  level:     { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Intermediate' },
  position:  { type: String, enum: ['GK', 'DEF', 'MID', 'ATT'], default: 'MID' },
  socialLinks: {
    instagram: { type: String },
    snapchat:  { type: String },
    whatsapp:  { type: String },
    phone:     { type: String }
  },
  stats: {
    matchesPlayed: { type: Number, default: 0 },
    goals:         { type: Number, default: 0 },
    assists:       { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// Middleware pour protéger les routes
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

// Routes

// Page d'accueil protégée
app.get('/', requireLogin, (req, res) => {
  // Récupérer l'utilisateur pour afficher ses informations
  User.findById(req.session.userId)
    .then(user => {
      if (!user) {
        return res.redirect('/login');
      }
      Match.find({ players: user._id })
        .populate('creator', 'username')
        .populate('players', 'username') // Ajouté : récupérer les joueurs
        .then(matches => {
          // Rendre la page d'accueil avec les données de l'utilisateur et ses matchs
          res.render('dashboard', { 
            user: user,
            username: user.username,
            level: user.level,
            position: user.position,
            stats: user.stats,
            socialLinks: user.socialLinks,
            matches: matches // Ajout des matchs de l'utilisateur
          });
        })
    })
    .catch(err => {
      console.error('Erreur lors de la récupération de l\'utilisateur:', err);
      res.status(500).send('Erreur serveur');
    });

});

// Formulaire d'enregistrement
app.get('/register-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Enregistrement utilisateur
app.post('/register', async (req, res) => {
  try {
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,  // → pense à hasher le mdp en prod !
      level: req.body.level,
      position: req.body.position,
      socialLinks: {
        instagram: req.body.instagram,
        snapchat: req.body.snapchat,
        whatsapp: req.body.whatsapp,
        phone: req.body.phone
      },
      stats: {
        matchesPlayed: req.body.matchesPlayed || 0,
        goals: req.body.goals || 0,
        assists: req.body.assists || 0
      }
    });

    await newUser.save();
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Erreur serveur');
  }
});

// Formulaire de connexion
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Traitement login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).send('Utilisateur non trouvé');
    }

    // Ici on compare juste le password en clair (pas sécurisé)
    if (user.password !== password) {
      return res.status(400).send('Mot de passe incorrect');
    }

    // On sauvegarde l'id et username en session
    req.session.userId = user._id;
    req.session.username = user.username;

    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

// Create Match 
app.get('/create-match', requireLogin, (req, res) => {
  User.findById(req.session.userId)
    .then(user => {
      if (!user) {
        return res.redirect('/login');
      }
      res.render('create-match', { user: user });
    })
    .catch(err => {
      console.error('Erreur lors de la récupération de l\'utilisateur:', err);
      res.status(500).send('Erreur serveur');
    });
});

const Match = require('./models/Match'); // Assure-toi que ce fichier existe

app.post('/create-match', requireLogin, async (req, res) => {
  try {
    const { location, date, maxPlayers, notes } = req.body;

    const newMatch = new Match({
      creator: req.session.userId,
      location,
      date,
      maxPlayers,
      notes,
      players: [req.session.userId] // le créateur est aussi un joueur
    });

    await newMatch.save();
    res.redirect('/'); // ou vers /matches ou /my-matches
  } catch (err) {
    console.error('Erreur lors de la création du match :', err);
    res.status(500).send('Erreur serveur');
  }
});

app.get('/matches', requireLogin, (req, res) => {
  Match.find()
    .populate('creator', 'username')
    .populate('players', 'username') // Ajouté : récupérer les joueurs
    .then(matches => {
      res.render('matches', { matches });
    })
    .catch(err => {
      console.error('Erreur lors de la récupération des matchs:', err);
      res.status(500).send('Erreur serveur');
    });
});

app.get('/join-match/:matchId', requireLogin, (req, res) => {
  const matchId = req.params.matchId;

  Match.findById(matchId)
    .then(match => {
      if (!match) {
        return res.status(404).send('Match non trouvé');
      }

      // Vérifier si l'utilisateur est déjà inscrit
      if (match.players.includes(req.session.userId)) {
        return res.status(400).send('Vous êtes déjà inscrit à ce match');
      }

      // Ajouter l'utilisateur aux joueurs du match
      match.players.push(req.session.userId);
      return match.save();
    })
    .then(() => {
      res.redirect('/matches'); // Rediriger vers la liste des matchs
    })
    .catch(err => {
      console.error('Erreur lors de l\'inscription au match:', err);
      res.status(500).send('Erreur serveur');
    });
});

app.get('/leave-match/:matchId', requireLogin, (req, res) => {
  const matchId = req.params.matchId;

  Match.findById(matchId)
    .then(match => {
      if (!match) {
        return res.status(404).send('Match non trouvé');
      }

      // Vérifier si l'utilisateur est inscrit
      if (!match.players.includes(req.session.userId)) {
        return res.status(400).send('Vous n\'êtes pas inscrit à ce match');
      }

      // Retirer l'utilisateur des joueurs du match
      match.players.pull(req.session.userId);
      return match.save();
    })
    .then(() => {
      res.redirect('/'); // Rediriger vers la liste des matchs
    })
    .catch(err => {
      console.error('Erreur lors du retrait du match:', err);
      res.status(500).send('Erreur serveur');
    });
});

app.get('/delete-match/:matchId', requireLogin, (req, res) => {
  const matchId = req.params.matchId;

  Match.findById(matchId)
    .then(match => {
      if (!match) {
        return res.status(404).send('Match non trouvé');
      }

      // Vérifier si l'utilisateur est le créateur du match
      if (match.creator.toString() !== req.session.userId) {
        return res.status(403).send('Vous n\'êtes pas autorisé à supprimer ce match');
      }

      return Match.deleteOne({ _id: matchId });
    })
    .then(() => {
      res.redirect('/'); // Rediriger vers la liste des matchs
    })
    .catch(err => {
      console.error('Erreur lors de la suppression du match:', err);
      res.status(500).send('Erreur serveur');
    });
});

app.get('/edit-match/:matchId', requireLogin, (req, res) => {
  const matchId = req.params.matchId;

  Match.findById(matchId)
    .then(match => {
      if (!match) {
        return res.status(404).send('Match non trouvé');
      }

      // Vérifier si l'utilisateur est le créateur du match
      if (match.creator.toString() !== req.session.userId) {
        return res.status(403).send('Vous n\'êtes pas autorisé à modifier ce match');
      }

      res.render('edit-match', { match: match });
    })
    .catch(err => {
      console.error('Erreur lors de la récupération du match:', err);
      res.status(500).send('Erreur serveur');
    });
});

app.post('/edit-match/:matchId', requireLogin, (req, res) => {
  const matchId = req.params.matchId;
  const { location, maxPlayers, notes } = req.body;

  Match.findById(matchId)
    .then(match => {
      if (!match) {
        return res.status(404).send('Match non trouvé');
      }

      if (match.creator.toString() !== req.session.userId) {
        return res.status(403).send('Non autorisé');
      }

      match.location = location;
      match.maxPlayers = maxPlayers;
      match.notes = notes;

      return match.save();
    })
    .then(() => {
      res.redirect('/');
    })
    .catch(err => {
      console.error('Erreur lors de la mise à jour du match :', err);
      res.status(500).send('Erreur serveur');
    });
});

app.get('/match-over/:matchId', requireLogin, (req, res) => {
  Match.findById(req.params.matchId)
    .populate('players', 'username') // Pour voir les joueurs
    .then(match => {
      if (!match) return res.status(404).send('Match non trouvé');

      // Seul le créateur peut clôturer
      if (match.creator.toString() !== req.session.userId) {
        return res.status(403).send('Non autorisé');
      }

      res.render('match-over', { match });
    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Erreur serveur');
    });
});

app.post('/match-over/:matchId', requireLogin, async (req, res) => {
  try {
    const { players } = req.body;
    const matchId = req.params.matchId;

    const match = await Match.findById(matchId).populate('players');
    if (!match) return res.status(404).send('Match non trouvé');
    if (match.creator.toString() !== req.session.userId) return res.status(403).send('Non autorisé');

    for (const playerData of players) {
      const { id, goals, assists } = playerData;
      const user = await User.findById(id);
      if (!user) continue;

      user.stats.matchesPlayed += 1;
      user.stats.goals += parseInt(goals) || 0;
      user.stats.assists += parseInt(assists) || 0;

      await user.save();
    }

    // Supprimer ou archiver le match
    await Match.findByIdAndDelete(matchId);

    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});


// view profile by username
app.get('/profile/:username', requireLogin, (req, res) => {
  const username = req.params.username;

  User.findOne({ username: username })
    .then(user => {
      if (!user) {
        return res.status(404).send('Utilisateur non trouvé');
      }
      res.render('profile', { user: user });
    })
    .catch(err => {
      console.error('Erreur lors de la récupération de l\'utilisateur:', err);
      res.status(500).send('Erreur serveur');
    });
});

app.get('/my-profile', requireLogin, (req, res) => {
  User.findById(req.session.userId)
    .then(user => {
      if (!user) {
        return res.redirect('/login');
      }
      res.render('my-profile', { user: user });
    })
    .catch(err => {
      console.error('Erreur lors de la récupération de l\'utilisateur:', err);
      res.status(500).send('Erreur serveur');
    });
});

app.get('/edit-profile', requireLogin, (req, res) => {
  User.findById(req.session.userId)
    .then(user => {
      if (!user) {
        return res.redirect('/login');
      }
      res.render('edit-profile', { user: user });
    })
    .catch(err => {
      console.error('Erreur lors de la récupération de l\'utilisateur:', err);
      res.status(500).send('Erreur serveur');
    });
});

app.post('/edit-profile', requireLogin, async (req, res) => {
  const { username, email } = req.body;

  try {
    await User.findByIdAndUpdate(req.session.userId, {
      username,
      email
    });
    res.redirect('/my-profile');
  } catch (err) {
    console.error('Erreur lors de la mise à jour du profil:', err);
    res.status(500).send('Erreur serveur');
  }
});


// Déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});

