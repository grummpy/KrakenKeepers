// `node --test tests/` treats the directory as one entry point. This file
// pulls in every suite so that command runs the whole core.
import './rng.test.js';
import './movement.test.js';
import './collision.test.js';
import './scoring.test.js';
import './elimination.test.js';
import './powerups.test.js';
import './input.test.js';
import './arcade.test.js';
import './offline.test.js';
import './simulation.test.js';
