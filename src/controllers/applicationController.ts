import { Response } from 'express';
import Application from '../models/Application';
import Job from '../models/Job';
import Chat from '../models/Chat';
import { AuthRequest } from '../middleware/auth';

// Apply for a job
export const applyForJob = async (req: AuthRequest, res: Response) => {
    try {
        // Only authenticated user can apply for a job
        if (!req.user) {
            return res.status(401).json({ message: 'Only users can apply for jobs.' });
        }

        const userId = req.user.id;
        const { jobId, coverLetter, resume } = req.body;

        if (!jobId) {
            return res.status(400).json({ message: 'Job ID is required.' });
        }

        // Check if the job exists
        const job = await Job.findById(jobId);

        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        if (job.status !== 'active') {
            return res.status(400).json({ message: 'This job posting is no longer active' });
        }

        // Check if the user has already applied
        const existingApplication = await Application.findOne({
            job: jobId,
            user: userId
        });

        if (existingApplication) {
            return res.status(400).json({ message: 'You have already applied for this job.' });
        }

        // Create the application
        const application = new Application({
            job: jobId,
            user: userId,
            company: job.company,
            coverLetter,
            resume,
            status: 'pending'
        });

        const savedApplication = await application.save();

        // Create a chat between the applicant and the company
        const newChat = new Chat({
            applicationId: savedApplication._id,
            userId: userId,
            companyId: job.company,
            jobId: jobId,
            messages: [{
                sender: job.company,
                content: `Thank you for applying for ${job.title}. Our team will be in touch and you will be notified via this chat.`,
                timestamp: new Date(),
                isRead: false
            }]
        });

        await newChat.save();

        res.status(201).json({
            message: 'Application submitted successfully.',
            application: {
                id: application._id,
                jobId: application.job,
                status: application.status,
                appliedAt: application.appliedAt
            },
            chat: {
                id: newChat._id
            }
        });
    } catch (error) {
        console.error('Job application error:', error);
        res.status(500).json({
            message: 'Server error while submitting application.',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Get applications for a specific job (company only)
export const getJobApplications = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.company) {
            return res.status(401).json({ message: 'Only companies can view job applications.' });
        }

        const { jobId } = req.params;

        // Verify the job exists and belongs to the company
        const job = await Job.findOne({
            _id: jobId,
            company: req.company.id  // Use id instead of _id
        });

        if (!job) {
            return res.status(404).json({ message: 'Job not found or not authorized.' });
        }

        // Convert both to strings for comparison
        if (job.company.toString() !== req.company.id.toString()) {
            return res.status(403).json({
                message: 'Not authorized to view applications for this job'
            });
        }

        // Pagination
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Filter by status if provided
        const filter: any = { job: jobId };
        if (req.query.status && ['pending', 'reviewed', 'interviewing', 'rejected', 'accepted'].includes(req.query.status as string)) {
            filter.status = req.query.status;
        }

        const totalApplications = await Application.countDocuments(filter);
        const applications = await Application.find(filter)
            .populate('user', 'firstName lastName email location bio skills profileImage')
            .sort({ appliedAt: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            applications,
            currentPage: page,
            totalPages: Math.ceil(totalApplications / limit),
            totalApplications
        });
    } catch (error) {
        console.error('Error fetching job applications:', error);
        res.status(500).json({
            message: 'Server error while fetching applications',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

export const getApplicationById = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user && !req.company) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { id } = req.params;

        // First, fetch the application without population to check if it exists
        const applicationExists = await Application.findById(id);
        if (!applicationExists) {
            return res.status(404).json({ message: 'Application not found' });
        }

        // Permission checks (as before)
        if (req.company) {
            const job = await Job.findById(applicationExists.job);
            if (!job) {
                return res.status(404).json({ message: 'Associated job not found' });
            }

            const companyId = job.company.toString();
            const requestingCompanyId = req.company.id;

            if (companyId !== requestingCompanyId) {
                return res.status(403).json({
                    message: 'You do not have permission to view this application'
                });
            }
        } else if (req.user) {
            if (applicationExists.user.toString() !== req.user.id) {
                return res.status(403).json({
                    message: 'You do not have permission to view this application'
                });
            }
        }

        // Now fetch with population for the full details
        // For companies, include all relevant user profile fields
        const userFieldsToInclude = req.company
            ? 'firstName lastName email profileImage location bio skills experience education cv.originalName cv.uploadDate'
            : 'firstName lastName email profileImage';

        const application = await Application.findById(id)
            .populate('user', userFieldsToInclude)
            .populate({
                path: 'job',
                select: 'title company location type status',
                populate: {
                    path: 'company',
                    select: 'companyName logo'
                }
            });

        // Check if CV exists (for company view)
        if (req.company && application && application.user) {
            const user = application.user as any;
            // Add a field to indicate if CV is available (without sending the actual CV data)
            user.hasCv = !!(user.cv && (user.cv.originalName || user.cv._id));

            // Don't send CV data in the response, just metadata
            if (user.cv && user.cv.data) {
                delete user.cv.data;
            }
        }

        res.json(application);
    } catch (error) {
        console.error('Get application by ID error:', error);
        res.status(500).json({
            message: 'Server error while fetching application',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Download applicant CV (company only)
export const downloadApplicantCV = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.company) {
            return res.status(401).json({ message: 'Only companies can access applicant CVs' });
        }

        const { applicationId } = req.params;

        // Find the application
        const application = await Application.findById(applicationId)
            .populate('user')
            .populate('job');

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        // Check if the company owns this job
        const job = application.job as any;
        if (job.company.toString() !== req.company.id) {
            return res.status(403).json({
                message: 'You do not have permission to access this application'
            });
        }

        // Get the user's CV
        const user = application.user as any;
        if (!user.cv || !user.cv.data) {
            return res.status(404).json({ message: 'No CV found for this applicant' });
        }

        // Set appropriate headers for PDF download
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${user.firstName}_${user.lastName}_CV.pdf"`,
            'Content-Length': user.cv.size || user.cv.data.length
        });

        // Send the PDF data
        res.send(user.cv.data);
    } catch (error) {
        console.error('Download applicant CV error:', error);
        res.status(500).json({
            message: 'Server error while downloading applicant CV',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Update application status (company only)
export const updateApplicationStatus = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.company) {
            return res.status(401).json({ message: 'Only companies can update application status' });
        }

        const { applicationId } = req.params;
        const { status } = req.body;

        if (!status || !['pending', 'reviewed', 'interviewing', 'rejected', 'accepted'].includes(status)) {
            return res.status(400).json({
                message: 'Invalid status',
                allowedValues: ['pending', 'reviewed', 'interviewing', 'rejected', 'accepted']
            });
        }

        // Find the application and make sure it belong to a job from this company
        const application = await Application.findById(applicationId)
            .populate('job')

        if (!application) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        // Type assertion to access job.company
        const job = application.job as any;

        // Check if the job belong to the company making the request
        if (job.company.toString() !== req.company.id) {
            return res.status(403).json({ message: 'Not authorized to update this application.' });
        }

        application.status = status;
        await application.save();

        res.json({
            message: 'Application status updated successfully',
            application: {
                id: application._id,
                status: application.status,
                updatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('Update application status error:', error);
        res.status(500).json({
            message: 'Server error while updating application status',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Get user's job applications
export const getUserApplications = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Filter by status if provided
        const filter: any = { user: req.user.id };
        if (req.query.status && ['pending', 'reviewed', 'interviewing', 'rejected', 'accepted'].includes(req.query.status as string)) {
            filter.status = req.query.status;
        }

        const totalApplications = await Application.countDocuments(filter);
        const applications = await Application.find(filter)
            .populate({
                path: 'job',
                select: 'title company type location',
                populate: {
                    path: 'company',
                    select: 'companyName logo'
                }
            })
            .sort({ appliedAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            applications,
            currentPage: page,
            totalPages: Math.ceil(totalApplications / limit),
            totalApplications
        });
    } catch (error) {
        console.error('Get user application error:', error);
        res.status(500).json({
            message: 'Server error while fetching applications',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Withdraw a job application (user only)
export const withdrawApplication = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { applicationId } = req.params;

        // Find the application and make sure it belongs to this user
        const application = await Application.findOne({
            _id: applicationId,
            user: req.user.id
        });

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        // Only allow withdrawl if the application is still pending or being reviewed
        if (!['pending', 'reviewed'].includes(application.status)) {
            return res.status(400).json({
                message: `Cannot withdraw application with status "${application.status}"`,
                currentStatus: application.status
            });
        }

        await Application.findByIdAndDelete(applicationId);

        res.json({
            message: 'Application withdrawn successfully',
        });
    } catch (error) {
        console.error('Withdraw application error:', error);
        res.status(500).json({
            message: 'Server error while withdrawing application',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};