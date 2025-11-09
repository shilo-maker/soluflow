const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');
const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');
const WorkspaceInvitation = require('../models/WorkspaceInvitation');
const Service = require('../models/Service');
const ServiceSong = require('../models/ServiceSong');
const SongWorkspace = require('../models/SongWorkspace');

// Admin middleware - check for integration API key
const adminAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.INTEGRATION_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// DELETE /api/admin/workspaces/:workspaceName
router.delete('/workspaces/:workspaceName', adminAuth, async (req, res) => {
  const { workspaceName } = req.params;
  const transaction = await sequelize.transaction();

  try {
    // Defer foreign key constraints in this transaction
    await sequelize.query('SET CONSTRAINTS ALL DEFERRED', { transaction });

    console.log(`🔍 Searching for workspace: ${workspaceName}`);

    // Find the workspace
    const workspace = await Workspace.findOne({
      where: { name: workspaceName }
    });

    if (!workspace) {
      await transaction.rollback();
      return res.status(404).json({
        error: `Workspace "${workspaceName}" not found`
      });
    }

    console.log(`✅ Found workspace: ${workspace.name} (ID: ${workspace.id})`);

    // Count all associated data
    const memberCount = await WorkspaceMember.count({
      where: { workspace_id: workspace.id }
    });

    const invitationCount = await WorkspaceInvitation.count({
      where: { workspace_id: workspace.id }
    });

    const serviceCount = await Service.count({
      where: { workspace_id: workspace.id }
    });

    const services = await Service.findAll({
      where: { workspace_id: workspace.id },
      attributes: ['id']
    });
    const serviceIds = services.map(s => s.id);

    const serviceSongCount = serviceIds.length > 0
      ? await ServiceSong.count({
          where: { service_id: serviceIds }
        })
      : 0;

    const songWorkspaceCount = await SongWorkspace.count({
      where: { workspace_id: workspace.id }
    });

    console.log('📊 Data to be deleted:');
    console.log(`   - Workspace: 1 (${workspace.name})`);
    console.log(`   - Members: ${memberCount}`);
    console.log(`   - Invitations: ${invitationCount}`);
    console.log(`   - Services (Setlists): ${serviceCount}`);
    console.log(`   - Service Songs: ${serviceSongCount}`);
    console.log(`   - Song-Workspace associations: ${songWorkspaceCount}`);

    // Delete in order: child tables first, then parent
    // Using raw SQL to avoid Sequelize cascade issues

    // 1. Delete service songs
    if (serviceIds.length > 0) {
      const [deletedServiceSongs] = await sequelize.query(
        `DELETE FROM service_songs WHERE service_id = ANY($1)`,
        {
          bind: [serviceIds],
          transaction,
          type: sequelize.QueryTypes.DELETE
        }
      );
      console.log(`✓ Deleted service songs for ${serviceIds.length} services`);
    }

    // 2. Delete services
    const [deletedServices] = await sequelize.query(
      `DELETE FROM services WHERE workspace_id = $1`,
      {
        bind: [workspace.id],
        transaction,
        type: sequelize.QueryTypes.DELETE
      }
    );
    console.log(`✓ Deleted ${serviceCount} services (setlists)`);

    // 3. Delete workspace invitations
    const [deletedInvitations] = await sequelize.query(
      `DELETE FROM workspace_invitations WHERE workspace_id = $1`,
      {
        bind: [workspace.id],
        transaction,
        type: sequelize.QueryTypes.DELETE
      }
    );
    console.log(`✓ Deleted ${invitationCount} workspace invitations`);

    // 4. Delete workspace members
    const [deletedMembers] = await sequelize.query(
      `DELETE FROM workspace_members WHERE workspace_id = $1`,
      {
        bind: [workspace.id],
        transaction,
        type: sequelize.QueryTypes.DELETE
      }
    );
    console.log(`✓ Deleted ${memberCount} workspace members`);

    // 5. Delete song-workspace associations
    const [deletedSongWorkspaces] = await sequelize.query(
      `DELETE FROM song_workspaces WHERE workspace_id = $1`,
      {
        bind: [workspace.id],
        transaction,
        type: sequelize.QueryTypes.DELETE
      }
    );
    console.log(`✓ Deleted ${songWorkspaceCount} song-workspace associations`);

    // 6. Finally, delete the workspace itself
    await sequelize.query(
      `DELETE FROM workspaces WHERE id = $1`,
      {
        bind: [workspace.id],
        transaction,
        type: sequelize.QueryTypes.DELETE
      }
    );
    console.log(`✓ Deleted workspace: ${workspace.name}`);

    // Commit the transaction
    await transaction.commit();

    console.log('✅ Successfully deleted workspace and all associated data!');

    res.json({
      success: true,
      message: `Successfully deleted workspace "${workspaceName}" and all associated data`,
      deleted: {
        workspace: workspace.name,
        members: memberCount,
        invitations: invitationCount,
        services: serviceCount,
        serviceSongs: serviceSongCount,
        songWorkspaces: songWorkspaceCount
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error during deletion:', error.message);
    res.status(500).json({
      error: 'Failed to delete workspace',
      details: error.message
    });
  }
});

module.exports = router;
