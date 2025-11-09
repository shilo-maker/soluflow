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

    // Delete in order, handling foreign key constraints properly
    // The order matters: delete children before parents

    // 1. Delete service songs first (children of services)
    if (serviceIds.length > 0) {
      const deletedServiceSongs = await ServiceSong.destroy({
        where: { service_id: serviceIds },
        transaction,
        hooks: false,
        individualHooks: false
      });
      console.log(`✓ Deleted ${deletedServiceSongs} service songs`);
    }

    // 2. Delete services (children of workspace)
    const deletedServices = await Service.destroy({
      where: { workspace_id: workspace.id },
      transaction,
      hooks: false,
      individualHooks: false
    });
    console.log(`✓ Deleted ${deletedServices} services`);

    // 3. Delete song-workspace associations (references workspace)
    const deletedSongWorkspaces = await SongWorkspace.destroy({
      where: { workspace_id: workspace.id },
      transaction,
      hooks: false,
      individualHooks: false
    });
    console.log(`✓ Deleted ${deletedSongWorkspaces} song-workspace associations`);

    // 4. Delete workspace invitations (children of workspace)
    const deletedInvitations = await WorkspaceInvitation.destroy({
      where: { workspace_id: workspace.id },
      transaction,
      hooks: false,
      individualHooks: false
    });
    console.log(`✓ Deleted ${deletedInvitations} workspace invitations`);

    // 5. Delete workspace members LAST before workspace (references both workspace and users)
    const deletedMembers = await WorkspaceMember.destroy({
      where: { workspace_id: workspace.id },
      transaction,
      hooks: false,
      individualHooks: false,
      force: true
    });
    console.log(`✓ Deleted ${deletedMembers} workspace members`);

    // 6. Finally, delete the workspace itself
    const deletedWorkspace = await Workspace.destroy({
      where: { id: workspace.id },
      transaction,
      hooks: false,
      individualHooks: false
    });
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
