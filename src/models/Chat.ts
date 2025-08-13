import mongoose, { Schema, Document } from 'mongoose';

interface IMessage {
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

const messageSchema = new Schema<IMessage>({
      sender: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
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

const chatSchema = new Schema<IChat>(
      {
            applicationId: {
                  type: Schema.Types.ObjectId,
                  ref: 'Application',
                  required: true,
                  unique: true
            },
            userId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true
            },
            companyId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User', // Assuming companies are also users with a role
                  required: true
            },
            jobId: {
                  type: Schema.Types.ObjectId,
                  ref: 'Job',
                  required: true
            },
            messages: [messageSchema]
      },
      { timestamps: true }
);

const Chat = mongoose.model<IChat>('Chat', chatSchema);
export default Chat;