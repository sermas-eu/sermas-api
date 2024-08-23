import { Response } from 'express';
import { Socket } from 'net';

export class DetectionStreamerRequest {
  appId: string;
  overlay?: boolean;
  cameraId?: string;
  res: Response;
}

export interface VideoFrame extends Buffer {
  timestamp: number;
  headers?: Record<string, string | number>;
}

export interface CameraConfig {
  cameraId: string;
  appId: string;
  port: number;
}

export interface CameraHandler {
  port: number;
  socket: Socket;
  clients: ClientSocket[];
}

export interface ClientSocket {
  res: Response;
  drained: boolean;
}

export class VideoFrameEvent {
  cameraId: string;
  appId: string;
  frame: VideoFrame;
}
