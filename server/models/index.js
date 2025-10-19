const { sequelize } = require('../config/database');
const Workspace = require('./Workspace');
const User = require('./User');
const Song = require('./Song');
const Service = require('./Service');
const ServiceSong = require('./ServiceSong');
const Note = require('./Note');
const SharedService = require('./SharedService');

// Define associations

// Workspace associations
Workspace.hasMany(User, { foreignKey: 'workspace_id', as: 'users' });
Workspace.hasMany(Song, { foreignKey: 'workspace_id', as: 'songs' });
Workspace.hasMany(Service, { foreignKey: 'workspace_id', as: 'services' });

// User associations
User.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'workspace' });
User.hasMany(Song, { foreignKey: 'created_by', as: 'createdSongs' });
User.hasMany(Service, { foreignKey: 'created_by', as: 'createdServices' });
User.hasMany(Service, { foreignKey: 'leader_id', as: 'ledServices' });
User.hasMany(Note, { foreignKey: 'user_id', as: 'notes' });

// Song associations
Song.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'workspace' });
Song.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Song.hasMany(ServiceSong, { foreignKey: 'song_id', as: 'serviceSongs' });
Song.hasMany(Note, { foreignKey: 'song_id', as: 'notes' });
Song.belongsToMany(Service, {
  through: ServiceSong,
  foreignKey: 'song_id',
  otherKey: 'service_id',
  as: 'services'
});

// Service associations
Service.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'workspace' });
Service.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Service.belongsTo(User, { foreignKey: 'leader_id', as: 'leader' });
Service.hasMany(ServiceSong, { foreignKey: 'service_id', as: 'serviceSongs' });
Service.hasMany(Note, { foreignKey: 'service_id', as: 'notes' });
Service.belongsToMany(Song, {
  through: ServiceSong,
  foreignKey: 'service_id',
  otherKey: 'song_id',
  as: 'songs'
});

// ServiceSong associations
ServiceSong.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
ServiceSong.belongsTo(Song, { foreignKey: 'song_id', as: 'song' });

// Note associations
Note.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Note.belongsTo(Song, { foreignKey: 'song_id', as: 'song' });
Note.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });

// SharedService associations
SharedService.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
SharedService.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Service.hasMany(SharedService, { foreignKey: 'service_id', as: 'sharedWith' });
User.hasMany(SharedService, { foreignKey: 'user_id', as: 'sharedServices' });

// Many-to-many: Users can have many shared services, Services can be shared with many users
Service.belongsToMany(User, {
  through: SharedService,
  foreignKey: 'service_id',
  otherKey: 'user_id',
  as: 'sharedWithUsers'
});
User.belongsToMany(Service, {
  through: SharedService,
  foreignKey: 'user_id',
  otherKey: 'service_id',
  as: 'servicesSharedWithMe'
});

// Sync database (create tables)
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('✓ Database synchronized successfully');
  } catch (error) {
    console.error('✗ Error synchronizing database:', error);
    throw error;
  }
};

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully.');
  } catch (error) {
    console.error('✗ Unable to connect to the database:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  Workspace,
  User,
  Song,
  Service,
  ServiceSong,
  Note,
  SharedService,
  syncDatabase,
  testConnection
};
