import { Request, Response } from 'express';
import Company from '../models/Company';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';

// Get company by ID
export const getCompanyById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format to prevent errors
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid company ID format' });
    }

    // Find company by ID, excluding password field
    const company = await Company.findById(id).select('-password');

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Return company data
    res.json(company);
  } catch (error) {
    console.error('Get company by ID error:', error);
    res.status(500).json({
      message: 'Server error while fetching company',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Get all companies with pagination
export const getAllCompanies = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Optional industry filter
    const filter: any = {};
    if (req.query.industry) {
      filter.industry = req.query.industry;
    }

    // Get total count and companies
    const totalCompanies = await Company.countDocuments(filter);
    const companies = await Company.find(filter)
      .select('-password') // Exclude password
      .sort({ companyName: 1 }) // Sort alphabetically
      .skip(skip)
      .limit(limit);

    res.json({
      companies,
      currentPage: page,
      totalPages: Math.ceil(totalCompanies / limit),
      totalCompanies
    });
  } catch (error) {
    console.error('Get all companies error:', error);
    res.status(500).json({
      message: 'Server error while fetching companies',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Update company profile (protected)
export const updateCompanyProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.company) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { companyName, industry, location, website, description } = req.body;

    // Find and update company
    const company = await Company.findById(req.company.id);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Update fields if provided
    if (companyName) company.companyName = companyName;
    if (industry) company.industry = industry;
    if (location) company.location = location;
    if (website) company.website = website;
    if (description) company.description = description;

    await company.save();

    // Return updated company without password
    const updatedCompany = await Company.findById(req.company.id).select('-password');
    res.json(updatedCompany);
  } catch (error) {
    console.error('Update company profile error:', error);
    res.status(500).json({
      message: 'Server error while updating company profile',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const getCompanyWithJobs = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid company ID format' });
    }

    // Get company data
    const company = await Company.findById(id).select('-password');

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Get active jobs for this company
    const activeJobs = await mongoose.model('Job').find({
      company: id,
      status: 'active'
    }).sort({ postedAt: -1 });

    // Return combined response
    res.json({
      company,
      jobs: activeJobs,
      jobCount: activeJobs.length
    });
  } catch (error) {
    console.error('Get company with jobs error:', error);
    res.status(500).json({
      message: 'Server error while fetching company details',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};