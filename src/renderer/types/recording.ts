export type VideoRecordingFormat =
  | 'fmp4' // Fragmented MP4 (fail-safe)
  | 'mkv'  // Matroska
  | 'mp4'  // Standard MP4
  | 'mov'  // QuickTime MOV
  | 'webm';

export type AudioRecordingFormat =
  | 'wav-48-24' // 24-bit 48kHz Broadcast WAV
  | 'wav-96-24' // 24-bit 96kHz High-Res WAV
  | 'wav-44-16' // 16-bit 44.1kHz CD standard
  | 'flac'      // Lossless FLAC
  | 'mp3-320'   // 320k High Quality MP3
  | 'mp3-192'   // 192k Standard MP3
  | 'aac-256'   // 256k AAC (m4a)
  | 'ogg';

export type HardwareVideoEncoder =
  | 'auto'
  | 'h264_videotoolbox' // Apple Silicon / macOS hardware encoder
  | 'hevc_videotoolbox'
  | 'h264_nvenc'        // NVIDIA NVENC
  | 'hevc_nvenc'
  | 'h264_qsv'          // Intel QuickSync
  | 'h264_amf'          // AMD AMF
  | 'libx264'           // CPU fallback
  | 'libx265';

export interface VideoRecordingConfig {
  format: VideoRecordingFormat;
  encoder: HardwareVideoEncoder;
  resolution: { width: number; height: number };
  framerate: number; // 30, 60
  bitrateKbps: number; // e.g. 12000 for 1080p, 25000 for 4K
  keyframeIntervalSec: number;
  outputDirectory: string;
  autoSplitEnabled: boolean;
  autoSplitSizeMb?: number;
  autoSplitDurationMin?: number;
}

export interface AudioRecordingConfig {
  format: AudioRecordingFormat;
  sampleRate: 44100 | 48000 | 96000;
  bitDepth: 16 | 24 | 32;
  channels: 2 | 8; // Stereo mix vs 8-track multitrack stems
  recordMultitrackStems: boolean;
  outputDirectory: string;
}

export interface RecordingStatus {
  isVideoRecording: boolean;
  isAudioRecording: boolean;
  videoDurationSec: number;
  audioDurationSec: number;
  videoBytesWritten: number;
  audioBytesWritten: number;
  videoCurrentFilePath: string | null;
  audioCurrentFilePath: string | null;
  droppedFrames: number;
  fps: number;
  cpuUsagePercent: number;
  diskSpaceFreeMb: number;
  error: string | null;
}

export function createDefaultVideoRecordingConfig(): VideoRecordingConfig {
  return {
    format: 'fmp4',
    encoder: 'auto',
    resolution: { width: 1920, height: 1080 },
    framerate: 60,
    bitrateKbps: 15000,
    keyframeIntervalSec: 2,
    outputDirectory: '',
    autoSplitEnabled: false,
  };
}

export function createDefaultAudioRecordingConfig(): AudioRecordingConfig {
  return {
    format: 'wav-48-24',
    sampleRate: 48000,
    bitDepth: 24,
    channels: 2,
    recordMultitrackStems: false,
    outputDirectory: '',
  };
}
