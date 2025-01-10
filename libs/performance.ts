import { Logger } from '@nestjs/common';

export class Perf {
  private static logger = new Logger(Perf.name);

  static start(label?: string, threshold = 1500, logger?: Logger) {
    logger = logger || this.logger;
    const t0 = performance.now();
    return (label2?: string, print = true) => {
      const msElapsed = performance.now() - t0;
      const value = Math.floor(msElapsed * 1000) / 1000;
      const aboveThreshold = value >= threshold;
      const criticalThreshold = threshold * 10;
      const reallyAboveThreshold = value >= criticalThreshold;

      if (print || aboveThreshold) {
        const msg = `${label2 || label} time elapsed ${value}ms`;
        if (reallyAboveThreshold) {
          logger.error(
            `${msg} (above critical threshold ${criticalThreshold}ms)`,
          );
        } else if (aboveThreshold) {
          logger.warn(`${msg} (above threshold ${threshold}ms)`);
        } else {
          logger.verbose(msg);
        }
      }

      return msElapsed;
    };
  }
}

export type PerfStart = (label?: string, print?: boolean) => number;
