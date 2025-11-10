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

    let workspaceServices = [];
    let sharedServices = [];

    // Get services from user's active workspace
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

      workspaceServices = services.map(s => {
        const service = s.toJSON();
        service.isShared = service.created_by !== req.user.id;
        service.canEdit = true; // Admins/planners can edit all
        service.isFromSharedLink = false;
        service.isCreator = service.created_by === req.user.id; // Track if user is the creator
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

      workspaceServices = services.map(s => {
        const service = s.toJSON();
        service.isShared = service.created_by !== req.user.id;
        service.canEdit = false; // Members cannot edit any services
        service.isFromSharedLink = false;
        service.isCreator = service.created_by === req.user.id; // Track if user is the creator
        return service;
      });
    }

    // Get services shared with this user (from other workspaces)
    // ONLY show shared services in personal workspace
    const currentWorkspace = await Workspace.findByPk(workspaceId);
    const isPersonalWorkspace = currentWorkspace && currentWorkspace.workspace_type === 'personal';

    if (isPersonalWorkspace) {
      const sharedServiceRecords = await SharedService.findAll({
        where: {
          user_id: req.user.id
        },
        include: [
          {
            model: Service,
            as: 'service',
            where: {
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
          }
        ]
      });

      sharedServices = sharedServiceRecords.map(ss => {
        const service = ss.service.toJSON();
        service.isShared = true;
        service.canEdit = false; // Shared services are read-only
        service.isFromSharedLink = true; // Mark as added via share link
        return service;
      });
    }

    // Combine workspace services and shared services, removing duplicates
    const serviceMap = new Map();

    // Add workspace services first
    workspaceServices.forEach(s => {
      serviceMap.set(s.id, s);
    });

    // Add shared services (only if not already in workspace)
    sharedServices.forEach(s => {
      if (!serviceMap.has(s.id)) {
        serviceMap.set(s.id, s);
      }
    });

    const allServices = Array.from(serviceMap.values());

    // Get current date and time
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    // Add isToday and isPast flags to services
    allServices.forEach(service => {
      if (service.date) {
        const serviceDate = new Date(service.date);
        const serviceDateOnly = new Date(serviceDate);
        serviceDateOnly.setHours(0, 0, 0, 0);

        // Check if service is today
        service.isToday = serviceDateOnly.getTime() === today.getTime();

        // Check if service is more than 24 hours in the past
        // Combine date and time for accurate comparison
        if (service.time) {
          const [hours, minutes] = service.time.split(':').map(Number);
          const serviceDateTime = new Date(serviceDate);
          serviceDateTime.setHours(hours, minutes, 0, 0);
          service.isPast = serviceDateTime < twentyFourHoursAgo;
        } else {
          // If no time specified, just check the date
          const endOfDay = new Date(serviceDate);
          endOfDay.setHours(23, 59, 59, 999);
          service.isPast = endOfDay < twentyFourHoursAgo;
        }
      } else {
        service.isToday = false;
        service.isPast = false;
      }
    });

    // Sort by date - future first (descending), with earliest time first for same day
    allServices.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB - dateA; // Descending order: future -> past
      }
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeA.localeCompare(timeB); // Ascending time for same day
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

      serviceData.songs = serviceData.serviceSongs.map(ss => {
        if (!ss.song) return null;
        return {
          ...ss.song,
          transposition: ss.transposition || 0, // Include transposition from ServiceSong
          serviceSongId: ss.id // Include ServiceSong ID for reference
        };
      }).filter(song => song !== null);

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
      where: { code },
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
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check if service link has expired (1 day after service date)
    if (service.date) {
      const serviceDate = new Date(service.date);

      // If service has a time, use it; otherwise assume end of day
      if (service.time) {
        const [hours, minutes] = service.time.split(':');
        serviceDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        serviceDate.setHours(23, 59, 59, 999);
      }

      // Add 1 day
      const expirationDate = new Date(serviceDate);
      expirationDate.setDate(expirationDate.getDate() + 1);

      const now = new Date();
      if (now > expirationDate) {
        return res.status(410).json({ error: 'This service link has expired' });
      }
    }

    // Transform serviceSongs to songs array for frontend
    const serviceData = service.toJSON();
    if (serviceData.serviceSongs) {
      serviceData.songs = serviceData.serviceSongs.map(ss => {
        if (!ss.song) return null;
        return {
          ...ss.song,
          transposition: ss.transposition || 0, // Include transposition from ServiceSong
          serviceSongId: ss.id // Include ServiceSong ID for reference
        };
      }).filter(song => song !== null);
      delete serviceData.serviceSongs;
    }

    // Check if authenticated user already has this service
    if (req.user && req.user.id) {
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
      res.json(serviceData);
    } else {
      console.log('No authenticated user - guest access, generating guest token');
      serviceData.alreadyAdded = false;
      serviceData.isOwner = false;

      // Generate guest token for unauthenticated users
      const { generateGuestToken } = require('../utils/jwt');
      const guestToken = generateGuestToken(service.id);

      res.json({
        ...serviceData,
        guestToken
      });
    }
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

    const { position, notes, segment_title, segment_content, transposition } = req.body;

    console.log(`[UPDATE] Song ${songId} in Service ${id}: position ${serviceSong.position} -> ${position}, transposition ${serviceSong.transposition} -> ${transposition}`);

    await serviceSong.update({
      position: position !== undefined ? position : serviceSong.position,
      notes: notes !== undefined ? notes : serviceSong.notes,
      segment_title: segment_title !== undefined ? segment_title : serviceSong.segment_title,
      segment_content: segment_content !== undefined ? segment_content : serviceSong.segment_content,
      transposition: transposition !== undefined ? transposition : serviceSong.transposition
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

// Update transposition for a song in a service
const updateSongTransposition = async (req, res) => {
  try {
    const { id, songId } = req.params; // service_id, song_id
    const { transposition } = req.body;

    // Validate transposition value (-11 to +11)
    if (typeof transposition !== 'number' || transposition < -11 || transposition > 11) {
      return res.status(400).json({ error: 'Transposition must be a number between -11 and +11' });
    }

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

    // Check permissions - only leader or admin/planner can update transposition
    const service = await Service.findByPk(parseInt(id));
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const isLeader = service.leader_id === req.user.id;
    const canEdit = await canEditServicesInWorkspace(req.user.id, service.workspace_id);

    if (!isLeader && !canEdit) {
      return res.status(403).json({
        error: 'Access denied. Only the service leader, admins, and planners can update transposition.'
      });
    }

    // Update transposition
    await serviceSong.update({ transposition });

    res.json({
      message: 'Transposition updated successfully',
      serviceSong: {
        id: serviceSong.id,
        service_id: serviceSong.service_id,
        song_id: serviceSong.song_id,
        transposition: serviceSong.transposition
      }
    });
  } catch (error) {
    console.error('Error updating song transposition:', error);
    res.status(500).json({ error: 'Failed to update song transposition' });
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

// Change service leader
const changeServiceLeader = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_leader_id } = req.body;

    if (!new_leader_id) {
      return res.status(400).json({ error: 'new_leader_id is required' });
    }

    // Get the service
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check if user is workspace admin
    const membership = await WorkspaceMember.findOne({
      where: {
        workspace_id: service.workspace_id,
        user_id: req.user.id
      }
    });

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. Only workspace admins can change service leadership.'
      });
    }

    // Verify new leader is a member of the workspace
    const newLeaderMembership = await WorkspaceMember.findOne({
      where: {
        workspace_id: service.workspace_id,
        user_id: new_leader_id
      }
    });

    if (!newLeaderMembership) {
      return res.status(400).json({
        error: 'New leader must be a member of the workspace'
      });
    }

    // Update the leader
    await service.update({ leader_id: new_leader_id });

    res.json({
      message: 'Service leader changed successfully',
      service
    });
  } catch (error) {
    console.error('Error changing service leader:', error);
    res.status(500).json({ error: 'Failed to change service leader' });
  }
};

// DELETE /api/services/:id/unshare - Remove a shared service from user's view
const unshareService = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the shared service record
    const sharedService = await SharedService.findOne({
      where: {
        service_id: id,
        user_id: userId
      }
    });

    if (!sharedService) {
      return res.status(404).json({
        error: 'Shared service not found',
        message: 'This service was not shared with you or has already been removed'
      });
    }

    // Delete the shared service record
    await sharedService.destroy();

    res.json({
      message: 'Shared service removed successfully',
      service_id: id
    });
  } catch (error) {
    console.error('Error unsharing service:', error);
    res.status(500).json({ error: 'Failed to remove shared service' });
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
  updateSongTransposition,
  acceptSharedService,
  getShareLink,
  moveToWorkspace,
  changeServiceLeader,
  unshareService
};
