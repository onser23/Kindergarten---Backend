const Package = require('../models/Package');
const Service = require('../models/Service');
const Lesson = require('../models/Lesson');
const Food = require('../models/Food');
const Event = require('../models/Event');
const Group = require('../models/Group');
const Teacher = require('../models/Teacher');
const Nanny = require('../models/Nanny');
const Child = require('../models/Child');

module.exports = {
  package: {
    Model: Package,
    entityName: 'paket',
    usageCheck: async (id) => {
      const count = await Child.countDocuments({ package: id, isActive: true });
      return { count, locations: count > 0 ? [`${count} aktiv uşaq`] : [] };
    },
    blockedMessage: (locs) =>
      `Bu paket ${locs[0]}da istifadə olunur. Əvvəlcə onları başqa paketə köçürün.`,
  },
  service: {
    Model: Service,
    entityName: 'xidmət',
    usageCheck: async (id) => {
      const count = await Package.countDocuments({ services: id, isActive: true });
      return { count, locations: count > 0 ? [`${count} aktiv paket`] : [] };
    },
    blockedMessage: (locs) =>
      `Bu xidmət ${locs[0]}də istifadə olunur. Əvvəlcə paketdən çıxarın.`,
  },
  lesson: {
    Model: Lesson,
    entityName: 'dərs',
    usageCheck: async (id) => {
      const count = await Package.countDocuments({ lessons: id, isActive: true });
      return { count, locations: count > 0 ? [`${count} aktiv paket`] : [] };
    },
    blockedMessage: (locs) =>
      `Bu dərs ${locs[0]}də istifadə olunur. Əvvəlcə paketdən çıxarın.`,
  },
  food: {
    Model: Food,
    entityName: 'qida',
    usageCheck: async () => ({ count: 0, locations: [] }),
    blockedMessage: () => '',
  },
  event: {
    Model: Event,
    entityName: 'tədbir',
    usageCheck: async () => ({ count: 0, locations: [] }),
    blockedMessage: () => '',
  },
  group: {
    Model: Group,
    entityName: 'qrup',
    usageCheck: async (id) => {
      const count = await Child.countDocuments({ group: id, isActive: true });
      return { count, locations: count > 0 ? [`${count} aktiv uşaq`] : [] };
    },
    blockedMessage: (locs) =>
      `Bu qrup ${locs[0]}da istifadə olunur. Əvvəlcə uşaqları başqa qrupa köçürün.`,
  },
  teacher: {
    Model: Teacher,
    entityName: 'müəllim',
    usageCheck: async (id) => {
      const lessonCount = await Lesson.countDocuments({ teachers: id, isActive: true });
      const groupCount = await Group.countDocuments({ teachers: id, isActive: true });
      const total = lessonCount + groupCount;
      const locations = [];
      if (lessonCount > 0) locations.push(`${lessonCount} aktiv dərs`);
      if (groupCount > 0) locations.push(`${groupCount} aktiv qrup`);
      return { count: total, locations };
    },
    blockedMessage: (locs) =>
      `Bu müəllim ${locs.join(' və ')}da təyin edilib. Əvvəlcə çıxarın.`,
  },
  nanny: {
    Model: Nanny,
    entityName: 'baxıcı',
    usageCheck: async (id) => {
      const count = await Group.countDocuments({ nannies: id, isActive: true });
      return { count, locations: count > 0 ? [`${count} aktiv qrup`] : [] };
    },
    blockedMessage: (locs) =>
      `Bu baxıcı ${locs[0]}da təyin edilib. Əvvəlcə çıxarın.`,
  },
};
