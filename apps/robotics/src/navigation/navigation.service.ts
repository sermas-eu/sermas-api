import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DialogueToolRequestDto } from 'apps/dialogue/src/dialogue.speech.dto';
import { UIAsyncApiService } from 'apps/ui/src/ui.async.service';
import { readFile } from 'fs/promises';
import { getConfigPath } from 'libs/sermas/sermas.utils';
import { fileExists } from 'libs/util';
import { compareTwoStrings } from 'string-similarity';
import { PoseDto, StatusDto, StatusEventDto } from '../robotics.dto';
import { AreaDto, NavigationSpaceDto } from './navigation.dto';

const MATCH_AREA_THRESH = 0.8;

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);

  spaces: Record<string, NavigationSpaceDto> = {};

  status: { [appId: string]: { [robotId: string]: StatusDto } };

  constructor(private readonly uiAsyncApi: UIAsyncApiService) {}

  onModuleInit() {
    this.import();
  }

  async testStatus() {
    const positions: PoseDto[] = [
      { position: { x: 100, y: 100, z: 0 }, orientation: undefined },
      { position: { x: 50, y: 50, z: 0 }, orientation: undefined },
      { position: { x: 25, y: 25, z: 0 }, orientation: undefined },
      { position: { x: 0, y: 0, z: 0 }, orientation: undefined },
    ];
    let lastPos = 0;
    setInterval(() => {
      this.onStatusUpdate({
        appId: 'spindoxlabs',
        status: {
          actualPosition: positions[lastPos],
          velocity: {
            linear: {
              x: Math.random() * 10,
              y: Math.random() * 10,
              z: Math.random() * 10,
            },
          },
        } as StatusDto,
      } as StatusEventDto);

      lastPos++;
      if (lastPos === positions.length) lastPos = 0;
    }, 5000);
  }

  @OnEvent('agent.tools.request', { async: true })
  async handleToolMessage(ev: DialogueToolRequestDto): Promise<void> {
    if (ev.name !== 'navigation-map') return;
    this.logger.log(`Received tool request: toggle ui navigation map`);
    this.uiAsyncApi.content({
      appId: ev.appId,
      contentType: 'navigation',
      content: ev.name,
    });
  }

  async import() {
    let spaces: NavigationSpaceDto[] = [];

    try {
      const spacesPath = `${getConfigPath()}/spaces.json`;
      if (!(await fileExists(spacesPath))) return;
      const raw = (await readFile(spacesPath)).toString();
      spaces = JSON.parse(raw) as NavigationSpaceDto[];
    } catch (e: any) {
      this.logger.warn(`Failed to read spaces config: ${e.message}`);
      return;
    }

    for (const space of spaces) {
      try {
        await this.importSpace(space);
      } catch (e: any) {
        this.logger.warn(
          `Failed to import space ${space.spaceId}: ${e.message}`,
        );
      }
    }
  }

  async importSpace(space: NavigationSpaceDto) {
    this.logger.debug(`Import space ${space.spaceId} ${space.name}`);
    // console.warn(space);

    if (space.map && space.options) {
      if (space.options.mapType === 'svg') {
        const raw = await readFile(space.map);
        /*const svgPaths = await getSvgPaths(
          raw,
          space.options?.svgAreaMatch?.tag,
          space.options?.svgAreaMatch?.match,
        );

        const areas = svgPaths.map((svgPath) => {
          const polygon = turf.polygon([svgPath.points], { id: svgPath.id });

          const centroid = turf.centroid(polygon);

          return {
            area: JSON.parse(JSON.stringify(polygon)) as Feature,
            areaId: svgPath.id,
            name: svgPath.id,
            position: {
              orientation: undefined,
              position: {
                x: centroid.geometry.coordinates[0],
                y: centroid.geometry.coordinates[1],
              },
            },
          } as AreaDto;
        });*/
        space.areas.forEach((area) => {
          const filtered = (space.areas || []).filter(
            (area1) => area1.areaId === area.areaId,
          );
          if (filtered.length) {
            filtered[0].name = filtered[0].name || area.name;
            filtered[0].area = filtered[0].area || area.area;
            filtered[0].position = filtered[0].position || area.position;
            return;
          }
          // add if not found
          space.areas.push(area);
        });

        // console.log(JSON.stringify(space.areas, null, 2));
      }
    }

    await this.save(space);
  }

  async save(space: NavigationSpaceDto) {
    this.spaces[space.spaceId] = space;
  }

  async remove(spaceId: string) {
    if (this.spaces[spaceId]) delete this.spaces[spaceId];
  }

  async getById(spaceId: string): Promise<NavigationSpaceDto | null> {
    return this.spaces[spaceId] || null;
  }

  async getSpaceByName(
    appId: string,
    name: string,
  ): Promise<NavigationSpaceDto | null> {
    for (const spaceId in this.spaces) {
      if (this.spaces[spaceId].appId !== appId) continue;
      if (this.spaces[spaceId].name === name) return this.spaces[spaceId];
    }
    return null;
  }

  async getAreaByName(appId: string, name: string): Promise<AreaDto | null> {
    console.log('SPACES: ' + JSON.stringify(this.spaces));
    for (const spaceId in this.spaces) {
      if (this.spaces[spaceId].appId !== appId) continue;
      for (const area of this.spaces[spaceId].areas) {
        if (area.name === name) return area;
      }
    }
    return null;
  }

  async matchAreaByName(appId: string, name: string): Promise<AreaDto | null> {
    for (const spaceId in this.spaces) {
      if (this.spaces[spaceId].appId !== appId) continue;
      for (const area of this.spaces[spaceId].areas) {
        if (compareTwoStrings(area.name, name) > MATCH_AREA_THRESH) return area;
        // if (area.name === name) return area;
      }
    }
    return null;
  }

  onStatusUpdate(payload: StatusEventDto) {
    if (!this.status) {
      this.status = { [payload.appId]: { robot: {} } };
    }
    this.status[payload.appId]['robot'] = payload.status;
  }

  async getStatus(appId: string, robotId = 'robot') {
    if (!this.status) {
      throw new NotFoundException();
    }
    return this.status[appId][robotId];
  }
}
