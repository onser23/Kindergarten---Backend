const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

require('../models/Teacher');
require('../models/Nanny');
require('../models/Group');
require('../models/Package');
require('../models/Child');
require('../models/Payment');
require('../models/Refund');
require('../models/Service');
require('../models/Lesson');
require('../models/Food');
require('../models/Event');

let mongoServer;

module.exports = {
  connect: async () => {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  },
  close: async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  },
  clear: async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
};
