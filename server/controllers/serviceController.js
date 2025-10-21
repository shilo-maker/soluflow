const { Service, User, Song, ServiceSong, Workspace, SharedService, WorkspaceMember } = require('../models');
const { Op } = require('sequelize');

// Helper function to check if user can edit services in workspace
const canEditServicesInWorkspace = async (userId, workspaceId) => {
  const membership = await WorkspaceMember.findOne({
    where: {
      user_id: userId,
      workspace_id: workspaceId,
      role: { [Op.in]: ['admin', 'planner'] }
    }
  });
  return !!membership;
};

// Get all services for the authenticated user
const getAllServices = async (req, res) => {
  try {
    // Use active_workspace_id to filter services
    const workspaceId = req.user.active_workspace_id;

    // Check if user is admin or planner in this workspace
    const canEditAll = await canEditServicesInWorkspace(req.user.id, workspaceId);

    let allServices;

    if (canEditAll) {
      // Admins and planners see ALL services in the workspace
      const services = await Service.findAll({
        where: {
          workspace_id: workspaceId,
          is_archived: false
        },
        include: [
          {
            model: User,
            as: 'leader',
            attributes: ['id', 'username', 'email']
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username', 'email']
          }
        ]
      });

      allServices = services.map(s => {
        const service = s.toJSON();
        service.isShared = service.created_by !== req.user.id;
        service.canEdit = true; // Admins/planners can edit all
        return service;
      });
    } else {
      // Members can VIEW all services in the workspace (read-only)
      const services = await Service.findAll({
        where: {
          workspace_id: workspaceId,
          is_archived: false
        },
        include: [
          {
            model: User,
            as: 'leader',
            attributes: ['id', 'username', 'email']
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username', 'email']
          }
        ]
      });

      allServices = services.map(s => {
        const service = s.toJSON();
        service.isShared = service.created_by !== req.user.id;
        service.canEdit = false; // Members cannot edit any services
        return service;
      });
    }

    // Sort by date
    allServices.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB - dateA;
      }
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeB.localeCompare(timeA);
    });

    res.json(allServices);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
};

// Get a single service by ID with its set list
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findByPk(id, {
      include: [
        {
          model: User,
          as: 'leader',
          attributes: ['id', 'username', 'email']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        },
        {
          model: ServiceSong,
          as: 'serviceSongs',
          include: [
            {
              model: Song,
              as: 'song'
            }
          ]
        }
      ],
      order: [[{ model: ServiceSong, as: 'serviceSongs' }, 'position', 'ASC']]
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check if user has access to this service
    const isOwner = service.created_by === req.user.id;

    // Check if user is a member of the workspace this service belongs to
    const workspaceMembership = await WorkspaceMember.findOne({
      where: {
        workspace_id: service.workspace_id,
        user_id: req.user.id
      }
    });

    // Check if service is shared with the user
    const sharedService = await SharedService.findOne({
      where: {
        service_id: id,
        user_id: req.user.id
      }
    });

    // Allow access if user is owner, workspace member, or has service shared with them
    if (!isOwner && !workspaceMembership && !sharedService) {
      return res.status(403).json({ error: 'Access denied. You do not have access to this service.' });
    }

    // Transform serviceSongs to songs array for frontend
    const serviceData = service.toJSON();
    serviceData.isShared = !isOwner;
    if (serviceData.serviceSongs) {
      console.log('[GET SERVICE] ServiceSongs order from DB:');
      serviceData.serviceSongs.forEach(ss => {
        console.log(`  Position: ${ss.position}, Song ID: ${ss.song_id}, Song Title: ${ss.song?.title || 'N/A'}`);
      });

      serviceData.songs = serviceData.serviceSongs.map(ss => ss.song).filter(song => song !== null);

      console.log('[GET SERVICE] Songs array after mapping:');
      serviceData.songs.forEach((song, index) => {
        console.log(`  Index: ${index}, Song ID: ${song.id}, Song Title: ${song.title}`);
      });

      delete serviceData.serviceSongs;
    }

    res.json(serviceData);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
};

// Get service by code (for guest access)
const getServiceByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const service = await Service.findOne({
      where: { code, is_public: true },
      include: [
        {
          model: User,
          as: 'leader',
          attributes: ['id', 'username']
        },
        {
          model: ServiceSong,
          as: 'serviceSongs',
          include: [
            {
              model: Song,
              as: 'song'
            }
          ]
        }
      ],
      order: [[{ model: ServiceSong, as: 'serviceSongs' }, 'position', 'ASC']]
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found or not public' });
    }

    // Transform serviceSongs to songs array for frontend
    const serviceData = service.toJSON();
    if (serviceData.serviceSongs) {
      serviceData.songs = serviceData.serviceSongs.map(ss => ss.song).filter(song => song !== null);
      delete serviceData.serviceSongs;
    }

    // Check if authenticated user already has this service
    if (req.user) {
      console.log('User authenticated:', req.user.id, req.user.email);
      const isOwner = service.created_by === req.user.id;
      const sharedService = await SharedService.findOne({
        where: {
          service_id: service.id,
          user_id: req.user.id
        }
      });
      serviceData.alreadyAdded = isOwner || !!sharedService;
      serviceData.isOwner = isOwner;
      console.log('Already added check:', { isOwner, hasSharedService: !!sharedService, alreadyAdded: serviceData.alreadyAdded });
    } else {
      console.log('No authenticated user - guest access');
      serviceData.alreadyAdded = false;
      serviceData.isOwner = false;
    }

    res.json(serviceData);
  } catch (error) {
    console.error('Error fetching service by code:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
};

// Create a new service
const createService = async (req, res) => {
  try {
    const {
      title,
      date,
      time,
      location,
      leader_id,
      created_by,
      is_public
    } = req.body;

    // Use active_workspace_id if workspace_id not provided in body
    const workspace_id = req.body.workspace_id || req.user?.active_workspace_id;

    if (!workspace_id || !title) {
      return res.status(400).json({
        error: 'workspace_id (or active workspace) and title are required'
      });
    }

    // Check if user has permission to create services in this workspace
    const canEdit = await canEditServicesInWorkspace(req.user.id, workspace_id);
    if (!canEdit) {
      return res.status(403).json({
        error: 'Access denied. Only admins and planners can create services in this workspace.'
      });
    }

    // Generate unique code (4 characters)
    const generateCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let code = generateCode();
    // Ensure code is unique
    let existing = await Service.findOne({ where: { code } });
    while (existing) {
      code = generateCode();
      existing = await Service.findOne({ where: { code } });
    }

    const service = await Service.create({
      workspace_id,
      title,
      date,
      time,
      location,
      leader_id,
      created_by: created_by || req.user?.id,
      code,
      is_public: is_public !== undefined ? is_public : false
    });

    res.status(201).json(service);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
};

// Update a service
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      date,
      time,
      location,
      leader_id,
      is_public,
      is_archived
    } = req.body;

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check if user has permission to edit services in this workspace
    const canEdit = await canEditServicesInWorkspace(req.user.id, service.workspace_id);
    if (!canEdit) {
      return res.status(403).json({
        error: 'Access denied. Only admins and planners can update services in this workspace.'
      });
    }

    await service.update({
      title: title !== undefined ? title : service.title,
      date: date !== undefined ? date : service.date,
      time: time !== undefined ? time : service.time,
      location: location !== undefined ? location : service.location,
      leader_id: leader_id !== undefined ? leader_id : service.leader_id,
      is_public: is_public !== undefined ? is_public : service.is_public,
      is_archived: is_archived !== undefined ? is_archived : service.is_archived
    });

    res.json(service);
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
};

// Delete a service
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check if user has permission to delete services in this workspace
    const canEdit = await canEditServicesInWorkspace(req.user.id, service.workspace_id);
    if (!canEdit) {
      return res.status(403).json({
        error: 'Access denied. Only admins and planners can delete services in this workspace.'
      });
    }

    await service.destroy();

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
};

// Add song to service
const addSongToService = async (req, res) => {
  try {
    const { id } = req.params; // service_id
    const {
      song_id,
      position,
      segment_type,
      segment_title,
      segment_content,
      notes
    } = req.body;

    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check if user has permission to edit services in this workspace
    const canEdit = await canEditServicesInWorkspace(req.user.id, service.workspace_id);
    if (!canEdit) {
      return res.status(403).json({
        error: 'Access denied. Only admins and planners can edit service setlists.'
      });
    }

    const serviceSong = await ServiceSong.create({
      service_id: id,
      song_id,
      position: position !== undefined ? position : 0,
      segment_type: segment_type || 'song',
      segment_title,
      segment_content,
      notes
    });

    res.status(201).json(serviceSong);
  } catch (error) {
    console.error('Error adding song to service:', error);
    res.status(500).json({ error: 'Failed to add song to service' });
  }
};

// Update service song
const updateServiceSong = async (req, res) => {
  try {
    const { id, songId } = req.params; // service_id, song_id (actual song ID)

    // Find the ServiceSong by service_id and song_id combination
    const serviceSong = await ServiceSong.findOne({
      where: {
        service_id: parseInt(id),
        song_id: parseInt(songId)
      }
    });

    if (!serviceSong) {
      return res.status(404).json({ error: 'Service song not found' });
    }

    // Check permissions
    const service = await Service.findByPk(parseInt(id));
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const canEdit = await canEditServicesInWorkspace(req.user.id, service.workspace_id);
    if (!canEdit) {
      return res.status(403).json({
        error: 'Access denied. Only admins and planners can edit service setlists.'
      });
    }

    const { position, notes, segment_title, segment_content } = req.body;

    console.log(`[UPDATE] Song ${songId} in Service ${id}: position ${serviceSong.position} -> ${position}`);

    await serviceSong.update({
      position: position !== undefined ? position : serviceSong.position,
      notes: notes !== undefined ? notes : serviceSong.notes,
      segment_title: segment_title !== undefined ? segment_title : serviceSong.segment_title,
      segment_content: segment_content !== undefined ? segment_content : serviceSong.segment_content
    });

    console.log(`[UPDATE] Song ${songId} saved with position: ${serviceSong.position}`);

    res.json(serviceSong);
  } catch (error) {
    console.error('Error updating service song:', error);
    res.status(500).json({ error: 'Failed to update service song' });
  }
};

// Remove song from service
const removeSongFromService = async (req, res) => {
  try {
    const { id, songId } = req.params; // service_id, song_id (actual song ID)

    // Find the ServiceSong by service_id and song_id combination
    const serviceSong = await ServiceSong.findOne({
      where: {
        service_id: parseInt(id),
        song_id: parseInt(songId)
      }
    });

    if (!serviceSong) {
      return res.status(404).json({ error: 'Service song not found' });
    }

    // Check permissions
    const service = await Service.findByPk(parseInt(id));
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const canEdit = await canEditServicesInWorkspace(req.user.id, service.workspace_id);
    if (!canEdit) {
      return res.status(403).json({
        error: 'Access denied. Only admins and planners can edit service setlists.'
      });
    }

    await serviceSong.destroy();

    res.json({ message: 'Song removed from service successfully' });
  } catch (error) {
    console.error('Error removing song from service:', error);
    res.status(500).json({ error: 'Failed to remove song from service' });
  }
};

// Accept/add a shared service (for registered users)
const acceptSharedService = async (req, res) => {
  try {
    const { code } = req.params;

    // Find the service by code
    const service = await Service.findOne({
      where: { code, is_public: true }
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found or not available for sharing' });
    }

    // Check if service is upcoming (not past)
    const serviceDate = new Date(service.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    serviceDate.setHours(0, 0, 0, 0);

    if (serviceDate < today) {
      return res.status(400).json({ error: 'Cannot add past services to your list' });
    }

    // Check if user is the owner
    if (service.created_by === req.user.id) {
      return res.status(400).json({ error: 'You already own this service' });
    }

    // Check if already shared
    const existingShare = await SharedService.findOne({
      where: {
        service_id: service.id,
        user_id: req.user.id
      }
    });

    if (existingShare) {
      return res.status(400).json({ error: 'Service already added to your list' });
    }

    // Create the shared service record
    await SharedService.create({
      service_id: service.id,
      user_id: req.user.id
    });

    res.json({ message: 'Service added to your list successfully', service });
  } catch (error) {
    console.error('Error accepting shared service:', error);
    res.status(500).json({ error: 'Failed to add shared service' });
  }
};

// Get share link for a service
const getShareLink = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Verify ownership
    if (service.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You can only share your own services.' });
    }

    // Make service public if it isn't already
    if (!service.is_public) {
      await service.update({ is_public: true });
    }

    // Return the service code
    res.json({ code: service.code });
  } catch (error) {
    console.error('Error getting share link:', error);
    res.status(500).json({ error: 'Failed to get share link' });
  }
};

// Move service to another workspace
const moveToWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { target_workspace_id } = req.body;

    if (!target_workspace_id) {
      return res.status(400).json({ error: 'target_workspace_id is required' });
    }

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Verify ownership
    if (service.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You can only move your own services.' });
    }

    // Verify user is a member of the target workspace
    const { WorkspaceMember } = require('../models');
    const membership = await WorkspaceMember.findOne({
      where: {
        workspace_id: target_workspace_id,
        user_id: req.user.id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of the target workspace' });
    }

    // Update the service's workspace
    await service.update({ workspace_id: target_workspace_id });

    res.json({ message: 'Service moved successfully', service });
  } catch (error) {
    console.error('Error moving service to workspace:', error);
    res.status(500).json({ error: 'Failed to move service' });
  }
};

module.exports = {
  getAllServices,
  getServiceById,
  getServiceByCode,
  createService,
  updateService,
  deleteService,
  addSongToService,
  updateServiceSong,
  removeSongFromService,
  acceptSharedService,
  getShareLink,
  moveToWorkspace
};
