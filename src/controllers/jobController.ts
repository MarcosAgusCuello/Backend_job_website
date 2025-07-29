import { Response } from 'express';
import mongoose from 'mongoose';
import Job from '../models/Job';
import { AuthRequest } from '../middleware/auth';

// Create a new job posting
export const createJob = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.company) {
      return res.status(401).json({ message: 'Only companies can post jobs' });
    }

    const {
      title,
      location,
      description,
      requirements,
      type,
      salary,
      applicationLink,
      skills,
      experience,
      education,
      deadline,
      status
    } = req.body;

    // Validate required fields
    if (!title || !location || !description || !requirements || !type || !skills || !experience || !education) {
      return res.status(400).json({
        message: 'Missing required fields',
        required: ['title', 'location', 'description', 'requirements', 'type', 'skills', 'experience', 'education'],
        received: Object.keys(req.body)
      });
    }

    const job = new Job({
      title,
      company: req.company.id,
      location,
      description,
      requirements: Array.isArray(requirements) ? requirements : [requirements],
      type,
      salary,
      applicationLink,
      skills: Array.isArray(skills) ? skills : skills.split(',').map((skill: string) => skill.trim()),
      experience,
      education,
      deadline,
      status: status || 'active'
    });

    await job.save();

    res.status(201).json({
      message: 'Job posted successfully',
      job
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      message: 'Server error while creating job posting',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Get all jobs (with filtering and pagination)
export const getJobs = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object based on query params
    const filter: any = { status: 'active' };
    
    if (req.query.title) {
      filter.title = { $regex: req.query.title, $options: 'i' };
    }
    
    if (req.query.location) {
      filter.location = { $regex: req.query.location, $options: 'i' };
    }
    
    if (req.query.type) {
      filter.type = req.query.type;
    }
    
    if (req.query.skills) {
      const skillsArray = (req.query.skills as string).split(',');
      filter.skills = { $in: skillsArray };
    }

    if (req.query.company) {
      filter.company = new mongoose.Types.ObjectId(req.query.company as string);
    }

    const totalJobs = await Job.countDocuments(filter);
    const jobs = await Job.find(filter)
      .populate('company', 'companyName location industry logo')
      .sort({ postedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      jobs,
      currentPage: page,
      totalPages: Math.ceil(totalJobs / limit),
      totalJobs
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      message: 'Server error while fetching jobs',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Get jobs posted by a specific company (for company dashboard)
export const getCompanyJobs = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.company) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    const filter = { company: req.company.id };
    
    // Add status filter if provided
    if (req.query.status && ['active', 'closed', 'draft'].includes(req.query.status as string)) {
      filter['status' as keyof typeof filter] = req.query.status;
    }

    const totalJobs = await Job.countDocuments(filter);
    const jobs = await Job.find(filter)
      .sort({ postedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      jobs,
      currentPage: page,
      totalPages: Math.ceil(totalJobs / limit),
      totalJobs
    });
  } catch (error) {
    console.error('Get company jobs error:', error);
    res.status(500).json({
      message: 'Server error while fetching company jobs',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Get a specific job by ID
export const getJobById = async (req: AuthRequest, res: Response) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('company', 'companyName location industry description website logo');
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    res.json(job);
  } catch (error) {
    console.error('Get job by ID error:', error);
    res.status(500).json({
      message: 'Server error while fetching job details',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Update a job posting (company only)
export const updateJob = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.company) {
      return res.status(401).json({ message: 'Only companies can update jobs' });
    }

    const jobId = req.params.id;

    // Find the job and check if it belongs to the company
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Check if the company owns this job posting
    if (job.company.toString() !== req.company.id) {
      return res.status(403).json({ message: 'Not authorized to update this job posting' });
    }

    // Update the job fields
    const updateData: any = {};
    const updateableFields = [
      'title', 'location', 'description', 'requirements', 'type',
      'salary', 'applicationLink', 'skills', 'experience',
      'education', 'deadline', 'status'
    ];

    updateableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'skills' && !Array.isArray(req.body.skills)) {
          updateData.skills = req.body.skills.split(',').map((skill: string) => skill.trim());
        } else if (field === 'requirements' && !Array.isArray(req.body.requirements)) {
          updateData.requirements = [req.body.requirements];
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Job updated successfully',
      job: updatedJob
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      message: 'Server error while updating job posting',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Delete a job posting (company only)
export const deleteJob = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.company) {
      return res.status(401).json({ message: 'Only companies can delete jobs' });
    }

    const jobId = req.params.id;

    // Find the job and check if it belongs to the company
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Check if the company owns this job posting
    if (job.company.toString() !== req.company.id) {
      return res.status(403).json({ message: 'Not authorized to delete this job posting' });
    }

    await Job.findByIdAndDelete(jobId);

    res.json({
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      message: 'Server error while deleting job posting',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Search for jobs
export const searchJobs = async (req: AuthRequest, res: Response) => {
  try {
    const searchTerm = req.query.q as string;
    
    if (!searchTerm) {
      return res.status(400).json({ message: 'Search term is required' });
    }
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Use text search
    const query = { 
      $text: { $search: searchTerm },
      status: 'active'
    };

    const totalJobs = await Job.countDocuments(query);
    const jobs = await Job.find(query, { score: { $meta: 'textScore' } })
      .populate('company', 'companyName location industry logo')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit);

    res.json({
      jobs,
      currentPage: page,
      totalPages: Math.ceil(totalJobs / limit),
      totalJobs,
      searchTerm
    });
  } catch (error) {
    console.error('Search jobs error:', error);
    res.status(500).json({
      message: 'Server error while searching jobs',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};