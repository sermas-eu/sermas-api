import { VideoFrame } from 'apps/detection/src/detection.streamer.dto';
import * as fs from 'fs/promises';
import * as sharp from 'sharp';

export interface BoxOverlayTemplate {
  title: string;
}

export interface BoxStyle {
  color?: string;
  fontSize?: number;
}

export class BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;

  labelPosX?: number;
  labelPosY?: number;

  static load([x, y, x1, y1]: number[], label?: string): BoundingBox {
    return {
      x,
      y,
      width: x1 - x,
      height: y1 - y,
      label,
    } as BoundingBox;
  }
}

export class BoxedFrame {
  private defaultStyle: BoxStyle = {
    color: '#FF0000',
    fontSize: 14,
  };

  public constructor(
    private readonly imageWidth: number,
    private readonly imageHeight: number,
  ) {}

  public createOverlay(boundingBoxes: BoundingBox[], style?: BoxStyle): Buffer {
    style = { ...this.defaultStyle, ...(style || {}) };

    const head = `<svg width="${this.imageWidth}px" height="${this.imageHeight}px">
              <style>
                .box {
                    fill:none;
                    fill-opacity:0.0;
                    stroke:${style.color};
                    stroke-width:1
                }
                .label { 
                    font-style:normal;
                    font-weight:normal;
                    font-size:${style.fontSize}px;
                    line-height:1.25;
                    font-family:sans-serif;
                    fill:${style.color};
                    fill-opacity:1;
                    stroke:none;
                    stroke-width:0.25
                }
            </style>`;

    const tail = '</svg>';

    const boxes = boundingBoxes.map((box: BoundingBox) => {
      let labelPosX = box.x;
      let labelPosY = box.y + box.height + style.fontSize + 5;
      if (labelPosY > box.height) {
        labelPosY = box.y - style.fontSize - 5;
      }

      labelPosX = box.labelPosX || labelPosX;
      labelPosY = box.labelPosY || labelPosY;

      return `<rect class="box" width="${box.width}" height="${
        box.height
      }" x="${box.x}" y="${box.y}" />
                        <text class="label" x="${labelPosX}" y="${labelPosY}">${
        box.label || 'object'
      }</text>`;
    });

    return Buffer.from(head + boxes.join('') + tail);
  }

  public async draw(
    frame: VideoFrame,
    boundingBoxes: BoundingBox[],
  ): Promise<VideoFrame> {
    const buffer = (await sharp(frame)
      .composite([
        { input: this.createOverlay(boundingBoxes), top: 0, left: 0 },
      ])
      .toBuffer()) as VideoFrame;

    buffer.timestamp = frame.timestamp;
    buffer.headers = frame.headers;
    //this.saveImage(buffer)
    return buffer;
  }

  public async saveImage(
    buffer: VideoFrame,
    boxes?: BoundingBox[],
  ): Promise<void> {
    // console.log('Save detection boxes')
    const saveDir = '/app/data/detections';
    await fs.mkdir(saveDir, { recursive: true });
    fs.writeFile(`${saveDir}/image-${buffer.timestamp}.jpeg`, buffer);
    if (boxes)
      fs.writeFile(
        `${saveDir}/image-${buffer.timestamp}.json`,
        JSON.stringify(boxes, null, 2),
      );
  }
}
