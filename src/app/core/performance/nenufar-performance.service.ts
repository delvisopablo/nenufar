import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type NenufarPerformanceMode = 'full' | 'balanced' | 'lite';

export interface NenufarPerformanceProfile {
  mode: NenufarPerformanceMode;
  isMobile: boolean;
  isTablet: boolean;
  lowPower: boolean;
  reducedMotion: boolean;
  hardwareConcurrency: number;
  reviewLilyCount: number;
  promoLilyCount: number;
  showcaseLimit: number;
  frameIntervalMs: number;
  localCollisionEveryNFrames: number;
  sharedCollisionEveryNFrames: number;
  enableSharedCollisions: boolean;
  enableRipples: boolean;
  motionSpeedMultiplier: number;
  impulseMultiplier: number;
  secondaryDataDelayMs: number;
  preferSmallLocalAssets: boolean;
  background: {
    antialias: boolean;
    maxPixelRatio: number;
    frameIntervalMs: number;
    pondResolution: number;
    leafCount: number;
    gleamCount: number;
    baseWaveSources: number;
    maxClickSources: number;
  };
  loginPond: {
    padCount: number;
    corePadCount: number;
    frameIntervalMs: number;
  };
}

@Injectable({ providedIn: 'root' })
export class NenufarPerformanceService {
  getProfile(width = this.getViewportWidth()): NenufarPerformanceProfile {
    const hardwareConcurrency = this.getHardwareConcurrency();
    const reducedMotion = this.getReducedMotion();
    const userAgent = this.getUserAgent();
    const isMobile =
      width <= 700 ||
      /android|iphone|ipod|mobile/i.test(userAgent);
    const isTablet =
      !isMobile &&
      (width <= 1024 || /ipad|tablet/i.test(userAgent));
    const lowPower =
      reducedMotion ||
      hardwareConcurrency <= 4 ||
      width <= 430 ||
      /android.*(wv|version\/4)|iphone os 1[0-5]_/i.test(userAgent);
    const mode: NenufarPerformanceMode =
      isMobile || lowPower
        ? 'lite'
        : isTablet || hardwareConcurrency <= 6
          ? 'balanced'
          : 'full';

    if (mode === 'lite') {
      return {
        mode,
        isMobile,
        isTablet,
        lowPower,
        reducedMotion,
        hardwareConcurrency,
        reviewLilyCount: width <= 430 || lowPower ? 8 : 10,
        promoLilyCount: width <= 430 || lowPower ? 2 : 3,
        showcaseLimit: width <= 430 || lowPower ? 10 : 14,
        frameIntervalMs: reducedMotion ? 80 : 48,
        localCollisionEveryNFrames: reducedMotion ? 4 : 3,
        sharedCollisionEveryNFrames: 4,
        enableSharedCollisions: !reducedMotion && !lowPower,
        enableRipples: !reducedMotion,
        motionSpeedMultiplier: reducedMotion ? 0.42 : 0.66,
        impulseMultiplier: 0.76,
        secondaryDataDelayMs: 170,
        preferSmallLocalAssets: true,
        background: {
          antialias: false,
          maxPixelRatio: 1,
          frameIntervalMs: reducedMotion ? 90 : 56,
          pondResolution: 14,
          leafCount: 2,
          gleamCount: 2,
          baseWaveSources: 4,
          maxClickSources: 7,
        },
        loginPond: {
          padCount: width <= 430 || lowPower ? 12 : 15,
          corePadCount: 4,
          frameIntervalMs: reducedMotion ? 80 : 48,
        },
      };
    }

    if (mode === 'balanced') {
      return {
        mode,
        isMobile,
        isTablet,
        lowPower,
        reducedMotion,
        hardwareConcurrency,
        reviewLilyCount: 16,
        promoLilyCount: 5,
        showcaseLimit: 20,
        frameIntervalMs: 32,
        localCollisionEveryNFrames: 2,
        sharedCollisionEveryNFrames: 2,
        enableSharedCollisions: true,
        enableRipples: true,
        motionSpeedMultiplier: 0.82,
        impulseMultiplier: 0.88,
        secondaryDataDelayMs: 90,
        preferSmallLocalAssets: false,
        background: {
          antialias: false,
          maxPixelRatio: 1.35,
          frameIntervalMs: 34,
          pondResolution: 11,
          leafCount: 3,
          gleamCount: 4,
          baseWaveSources: 6,
          maxClickSources: 12,
        },
        loginPond: {
          padCount: 18,
          corePadCount: 5,
          frameIntervalMs: 34,
        },
      };
    }

    return {
      mode,
      isMobile,
      isTablet,
      lowPower,
      reducedMotion,
      hardwareConcurrency,
      reviewLilyCount: 26,
      promoLilyCount: 8,
      showcaseLimit: 28,
      frameIntervalMs: 16,
      localCollisionEveryNFrames: 1,
      sharedCollisionEveryNFrames: 1,
      enableSharedCollisions: true,
      enableRipples: true,
      motionSpeedMultiplier: 1,
      impulseMultiplier: 1,
      secondaryDataDelayMs: 0,
      preferSmallLocalAssets: false,
      background: {
        antialias: true,
        maxPixelRatio: 2,
        frameIntervalMs: 16,
        pondResolution: 8,
        leafCount: 5,
        gleamCount: 6,
        baseWaveSources: 8,
        maxClickSources: 18,
      },
      loginPond: {
        padCount: 24,
        corePadCount: 7,
        frameIntervalMs: 16,
      },
    };
  }

  logDev(label: string, payload?: unknown): void {
    if (environment.production) {
      return;
    }

    if (payload === undefined) {
      console.debug(`[Nenúfar perf] ${label}`);
      return;
    }

    console.debug(`[Nenúfar perf] ${label}`, payload);
  }

  private getHardwareConcurrency(): number {
    return typeof navigator !== 'undefined' && Number.isFinite(Number(navigator.hardwareConcurrency))
      ? Number(navigator.hardwareConcurrency)
      : 4;
  }

  private getReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private getUserAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : '';
  }

  private getViewportWidth(): number {
    return typeof window !== 'undefined' ? window.innerWidth : 1280;
  }
}
