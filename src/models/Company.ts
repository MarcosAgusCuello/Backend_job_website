import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export interface ICompany extends mongoose.Document {
  companyName: string;
  email: string;
  password: string;
  industry: string;
  location: string;
  description?: string;
  website?: string;
  logo?: string;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const CompanySchema = new mongoose.Schema<ICompany>({
  companyName: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true 
  },
  industry: { 
    type: String, 
    required: true 
  },
  location: { 
    type: String, 
    required: true 
  },
  description: String,
  website: String,
  logo: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Hash password before saving
CompanySchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password for login
CompanySchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<ICompany>('Company', CompanySchema);