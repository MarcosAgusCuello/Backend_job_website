import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
    sender: mongoose.Types.ObjectId;
    content: string;
    timestamp: Date;
    isRead: boolean;
}

export interface IChat extends Document {
    applicationId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    companyId: mongoose.Types.ObjectId;
    jobId: mongoose.Types.ObjectId;
    messages: IMessage[];
    createdAt: Date;
    updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
    sender: {
        type: Schema.Types.ObjectId,
        required: true,
        refPath: 'senderModel'
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    isRead: {
        type: Boolean,
        default: false
    }
});

const ChatSchema = new Schema<IChat>({
    applicationId: {
        type: Schema.Types.ObjectId,
        ref: 'Application',
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    jobId: {
        type: Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    messages: [MessageSchema]
}, { timestamps: true });

export default mongoose.model<IChat>('Chat', ChatSchema);