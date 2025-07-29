import mongoose from 'mongoose';

export interface IJob extends mongoose.Document {
  title: string;
  company: mongoose.Types.ObjectId;
  location?: string;
  description: string;
  requirements: string[];
  type: 'full-time' | 'part-time' | 'contract' | 'internship' | 'Remote';
  salary?: {
    min: number;
    max: number;
    currency: string;
  };
  applicationLink?: string; // URL to apply for the job
  skills: string[];
  experience?: string;
  education?: string;
  deadline?: Date;
  status: 'active' | 'closed' | 'draft';
  postedAt: Date;
}

const JobSchema = new mongoose.Schema<IJob>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  location: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: {
    type: [String],
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Remote']
  },
  salary: {
    min: Number,
    max: Number,
    currency: String
  },
  applicationLink: String,
  skills: {
    type: [String],
    required: true
  },
  experience: {
    type: String,
    required: true
  },
  education: {
    type: String,
    required: true
  },
  deadline: Date,
  status: {
    type: String,
    required: true,
    enum: ['active', 'closed', 'draft'],
    default: 'active'
  },
  postedAt: {
    type: Date,
    default: Date.now
  }
});

// Add text indexes for search functionality
JobSchema.index({
  title: 'text',
  description: 'text',
  skills: 'text',
  location: 'text'
});

export default mongoose.model<IJob>('Job', JobSchema);