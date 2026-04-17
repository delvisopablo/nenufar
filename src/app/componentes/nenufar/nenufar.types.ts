export interface NenufarVectorLike {
  x: number;
  y: number;
}

export interface NenufarBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export type NenufarBoundsMode = 'bounce' | 'none' | 'wrap';

export interface NenufarFlags {
  isMustio?: boolean;
  isOriginal?: boolean;
}

export interface NenufarEntity<TId extends string | number = string> extends NenufarFlags {
  angVel?: number;
  angularDamping?: number;
  bounds?: NenufarBounds;
  boundsMode?: NenufarBoundsMode;
  collisionEnabled?: boolean;
  id: TId;
  lastTouchedAt?: number;
  linearDamping?: number;
  maxSpeed?: number;
  maxSpin?: number;
  pos: NenufarVectorLike;
  prevPos?: NenufarVectorLike;
  radius: number;
  vel: NenufarVectorLike;
  wakeStrength?: number;
}

export interface NenufarCollisionConfig {
  impulseScale: number;
  restitution: number;
  separationFactor: number;
  spinFromImpact: number;
  spinFromTangential: number;
  tangentTransfer: number;
}

export interface NenufarEngineOptions<
  T extends NenufarEntity<string | number> = NenufarEntity<string | number>
> {
  bounds?: NenufarBounds;
  collision?: Partial<NenufarCollisionConfig>;
  defaultAngularDamping?: number;
  defaultBoundsMode?: NenufarBoundsMode;
  defaultLinearDamping?: number;
  defaultMaxSpeed?: number;
  defaultMaxSpin?: number;
  wrapBoost?: number;
}

export interface NenufarCollisionEvent<
  T extends NenufarEntity<string | number> = NenufarEntity<string | number>
> {
  a: T;
  b: T;
  closingSpeed: number;
  impactStrength: number;
  normal: NenufarVectorLike;
  overlap: number;
  tangentialVelocity: number;
}

export interface NenufarOutOfBoundsEvent<
  T extends NenufarEntity<string | number> = NenufarEntity<string | number>
> {
  axis: 'x' | 'y';
  edge: 'bottom' | 'left' | 'right' | 'top';
  entity: T;
  id: T['id'];
  mode: NenufarBoundsMode;
}

export interface NenufarStepOptions<
  T extends NenufarEntity<string | number> = NenufarEntity<string | number>
> {
  elapsed?: number;
  isActive?: (entity: T) => boolean;
  onCollision?: (event: NenufarCollisionEvent<T>) => void;
  onOutOfBounds?: (event: NenufarOutOfBoundsEvent<T>) => void;
}

export interface NenufarImpulseOptions {
  maxForce: number;
  minForce: number;
  spinJitterFactor?: number;
  spinJitterMin?: number;
  timestamp?: number;
  wakeStrengthBase?: number;
  wakeStrengthFactor?: number;
  wakeStrengthMax?: number;
  wakeStrengthMin?: number;
}

export interface NenufarImpulseResult {
  direction: NenufarVectorLike;
  distanceRatio: number;
  force: number;
}

export type NenufarKind = 'empty' | 'menu' | 'promo' | 'review';

export type NenufarActionType = 'emit' | 'navigate' | 'popup';

export type NenufarTone = 'fresh' | 'mustio';

export interface NenufarRenderState {
  opacity?: number;
  rotationDeg?: number;
  scale?: number;
  tone?: NenufarTone;
  visible?: boolean;
  x: number;
  y: number;
}

export interface NenufarLeftClickEvent<T = unknown> {
  data?: T;
  id: string;
  localPoint: NenufarVectorLike;
  nativeEvent: MouseEvent;
}

export interface NenufarRightClickEvent<T = unknown> {
  data?: T;
  id: string;
  nativeEvent: MouseEvent;
}

export interface NenufarHoverEvent<T = unknown> {
  data?: T;
  id: string;
}

export interface NenufarActionEvent<T = unknown> {
  actionType?: NenufarActionType;
  actionValue?: string;
  data?: T;
  id: string;
  nativeEvent?: MouseEvent;
}
