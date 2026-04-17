import {
  NenufarBounds,
  NenufarBoundsMode,
  NenufarCollisionConfig,
  NenufarCollisionEvent,
  NenufarEngineOptions,
  NenufarEntity,
  NenufarImpulseOptions,
  NenufarImpulseResult,
  NenufarOutOfBoundsEvent,
  NenufarStepOptions,
  NenufarVectorLike
} from './nenufar.types';

const DEFAULT_COLLISION: NenufarCollisionConfig = {
  impulseScale: 1,
  restitution: 0.8,
  separationFactor: 0.5,
  spinFromImpact: 0,
  spinFromTangential: 0,
  tangentTransfer: 0
};

export class NenufarEngine<
  T extends NenufarEntity<string | number> = NenufarEntity<string | number>
> {
  private readonly collision: NenufarCollisionConfig;
  private readonly entities = new Map<T['id'], T>();
  private bounds?: NenufarBounds;
  private readonly defaultAngularDamping?: number;
  private readonly defaultBoundsMode: NenufarBoundsMode;
  private readonly defaultLinearDamping?: number;
  private readonly defaultMaxSpeed?: number;
  private readonly defaultMaxSpin?: number;
  private readonly wrapBoost: number;

  constructor(options: NenufarEngineOptions<T> = {}) {
    this.bounds = options.bounds;
    this.collision = { ...DEFAULT_COLLISION, ...options.collision };
    this.defaultAngularDamping = options.defaultAngularDamping;
    this.defaultBoundsMode = options.defaultBoundsMode ?? 'bounce';
    this.defaultLinearDamping = options.defaultLinearDamping;
    this.defaultMaxSpeed = options.defaultMaxSpeed;
    this.defaultMaxSpin = options.defaultMaxSpin;
    this.wrapBoost = options.wrapBoost ?? 0;
  }

  addEntity(entity: T): T {
    this.entities.set(entity.id, entity);
    return entity;
  }

  clear(): void {
    this.entities.clear();
  }

  createEntity(entity: T): T {
    return this.addEntity(entity);
  }

  getAll(): T[] {
    return Array.from(this.entities.values());
  }

  getById(id: T['id']): T | undefined {
    return this.entities.get(id);
  }

  removeEntity(id: T['id']): void {
    this.entities.delete(id);
  }

  setBounds(bounds: NenufarBounds): void {
    this.bounds = bounds;
  }

  step(dt: number, options: NenufarStepOptions<T> = {}): void {
    if (dt <= 0) {
      return;
    }

    const activeEntities = this.getAll().filter((entity) => this.isActive(entity, options));
    const frameScale = dt * 60;

    for (const entity of activeEntities) {
      this.applyDamping(entity, frameScale);
      this.clampSpeed(entity);
      this.clampSpin(entity);

      entity.pos.x += entity.vel.x * dt;
      entity.pos.y += entity.vel.y * dt;

      this.resolveBounds(entity, options.onOutOfBounds);
    }

    for (let index = 0; index < activeEntities.length; index += 1) {
      const a = activeEntities[index];
      if (a.collisionEnabled === false) {
        continue;
      }

      for (let compareIndex = index + 1; compareIndex < activeEntities.length; compareIndex += 1) {
        const b = activeEntities[compareIndex];
        if (b.collisionEnabled === false) {
          continue;
        }

        const collision = this.resolveCircleCollision(a, b);
        if (!collision) {
          continue;
        }

        options.onCollision?.(collision);
      }
    }
  }

  applyImpulse(id: T['id'], impactPoint: NenufarVectorLike, options: NenufarImpulseOptions): NenufarImpulseResult | null {
    const entity = this.entities.get(id);
    if (!entity) {
      return null;
    }

    let dirX = entity.pos.x - impactPoint.x;
    let dirY = entity.pos.y - impactPoint.y;
    const dirLength = Math.hypot(dirX, dirY);

    if (dirLength < 1e-6) {
      const angle = Math.random() * Math.PI * 2;
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    } else {
      dirX /= dirLength;
      dirY /= dirLength;
    }

    const distance = Math.hypot(impactPoint.x - entity.pos.x, impactPoint.y - entity.pos.y);
    const distanceRatio = this.clamp(distance / Math.max(entity.radius, 1e-6), 0, 1);
    const force = this.lerp(options.minForce, options.maxForce, distanceRatio);

    entity.vel.x += dirX * force;
    entity.vel.y += dirY * force;

    if (typeof entity.angVel === 'number') {
      const spinJitterMin = options.spinJitterMin ?? 0;
      const spinJitterFactor = options.spinJitterFactor ?? 0;
      const spinDelta = spinJitterMin + distanceRatio * spinJitterFactor;
      if (spinDelta > 0) {
        entity.angVel += (Math.random() > 0.5 ? 1 : -1) * spinDelta;
        this.clampSpin(entity);
      }
    }

    if (options.timestamp !== undefined) {
      entity.lastTouchedAt = options.timestamp;
    }

    if (options.wakeStrengthBase !== undefined || options.wakeStrengthFactor !== undefined) {
      const wakeMin = options.wakeStrengthMin ?? 0;
      const wakeMax = options.wakeStrengthMax ?? 1;
      const wake = this.clamp(
        (options.wakeStrengthBase ?? 0) + distanceRatio * (options.wakeStrengthFactor ?? 0),
        wakeMin,
        wakeMax
      );
      entity.wakeStrength = Math.max(entity.wakeStrength ?? 0, wake);
    }

    this.clampSpeed(entity);

    return {
      direction: { x: dirX, y: dirY },
      distanceRatio,
      force
    };
  }

  private applyDamping(entity: T, frameScale: number): void {
    const linearDamping = entity.linearDamping ?? this.defaultLinearDamping;
    if (linearDamping !== undefined) {
      const dampingFactor = Math.pow(linearDamping, frameScale);
      entity.vel.x *= dampingFactor;
      entity.vel.y *= dampingFactor;
    }

    if (typeof entity.angVel === 'number') {
      const angularDamping = entity.angularDamping ?? this.defaultAngularDamping;
      if (angularDamping !== undefined) {
        entity.angVel *= Math.pow(angularDamping, frameScale);
      }
    }
  }

  private clampSpeed(entity: T): void {
    const maxSpeed = entity.maxSpeed ?? this.defaultMaxSpeed;
    if (maxSpeed === undefined) {
      return;
    }

    const speed = Math.hypot(entity.vel.x, entity.vel.y);
    if (speed <= maxSpeed || speed < 1e-6) {
      return;
    }

    const ratio = maxSpeed / speed;
    entity.vel.x *= ratio;
    entity.vel.y *= ratio;
  }

  private clampSpin(entity: T): void {
    if (typeof entity.angVel !== 'number') {
      return;
    }

    const maxSpin = entity.maxSpin ?? this.defaultMaxSpin;
    if (maxSpin === undefined) {
      return;
    }

    entity.angVel = this.clamp(entity.angVel, -maxSpin, maxSpin);
  }

  private emitOutOfBounds(
    entity: T,
    edge: NenufarOutOfBoundsEvent<T>['edge'],
    mode: NenufarBoundsMode,
    callback?: (event: NenufarOutOfBoundsEvent<T>) => void
  ): void {
    callback?.({
      axis: edge === 'left' || edge === 'right' ? 'x' : 'y',
      edge,
      entity,
      id: entity.id,
      mode
    });
  }

  private isActive(entity: T, options: NenufarStepOptions<T>): boolean {
    return options.isActive ? options.isActive(entity) : true;
  }

  private lerp(start: number, end: number, amount: number): number {
    return start + (end - start) * amount;
  }

  private resolveBounds(entity: T, callback?: (event: NenufarOutOfBoundsEvent<T>) => void): void {
    const bounds = entity.bounds ?? this.bounds;
    if (!bounds) {
      return;
    }

    const mode = entity.boundsMode ?? this.defaultBoundsMode;
    if (mode === 'none') {
      return;
    }

    const minX = Math.min(bounds.left, bounds.right);
    const maxX = Math.max(bounds.left, bounds.right);
    const minY = Math.min(bounds.top, bounds.bottom);
    const maxY = Math.max(bounds.top, bounds.bottom);
    const minXEdge = bounds.left <= bounds.right ? 'left' : 'right';
    const maxXEdge = bounds.left <= bounds.right ? 'right' : 'left';
    const minYEdge = bounds.top <= bounds.bottom ? 'top' : 'bottom';
    const maxYEdge = bounds.top <= bounds.bottom ? 'bottom' : 'top';

    if (mode === 'wrap') {
      if (entity.pos.x < minX - entity.radius) {
        entity.pos.x = maxX + entity.radius * 0.18;
        entity.vel.x += this.wrapBoost;
        this.emitOutOfBounds(entity, minXEdge, mode, callback);
      } else if (entity.pos.x > maxX + entity.radius) {
        entity.pos.x = minX - entity.radius * 0.18;
        entity.vel.x -= this.wrapBoost;
        this.emitOutOfBounds(entity, maxXEdge, mode, callback);
      }

      if (entity.pos.y < minY - entity.radius) {
        entity.pos.y = maxY + entity.radius * 0.18;
        entity.vel.y += this.wrapBoost;
        this.emitOutOfBounds(entity, minYEdge, mode, callback);
      } else if (entity.pos.y > maxY + entity.radius) {
        entity.pos.y = minY - entity.radius * 0.18;
        entity.vel.y -= this.wrapBoost;
        this.emitOutOfBounds(entity, maxYEdge, mode, callback);
      }

      this.clampSpeed(entity);
      return;
    }

    const left = minX + entity.radius;
    const right = maxX - entity.radius;
    const top = minY + entity.radius;
    const bottom = maxY - entity.radius;

    if (entity.pos.x <= left) {
      entity.pos.x = left;
      entity.vel.x = Math.abs(entity.vel.x);
      this.emitOutOfBounds(entity, minXEdge, mode, callback);
    } else if (entity.pos.x >= right) {
      entity.pos.x = right;
      entity.vel.x = -Math.abs(entity.vel.x);
      this.emitOutOfBounds(entity, maxXEdge, mode, callback);
    }

    if (entity.pos.y <= top) {
      entity.pos.y = top;
      entity.vel.y = Math.abs(entity.vel.y);
      this.emitOutOfBounds(entity, minYEdge, mode, callback);
    } else if (entity.pos.y >= bottom) {
      entity.pos.y = bottom;
      entity.vel.y = -Math.abs(entity.vel.y);
      this.emitOutOfBounds(entity, maxYEdge, mode, callback);
    }
  }

  private resolveCircleCollision(a: T, b: T): NenufarCollisionEvent<T> | null {
    let deltaX = b.pos.x - a.pos.x;
    let deltaY = b.pos.y - a.pos.y;
    let distance = Math.hypot(deltaX, deltaY);
    const minDistance = a.radius + b.radius;

    if (distance >= minDistance) {
      return null;
    }

    if (distance < 1e-5) {
      const angle = Math.random() * Math.PI * 2;
      deltaX = Math.cos(angle);
      deltaY = Math.sin(angle);
      distance = 1e-5;
    }

    const normalX = deltaX / distance;
    const normalY = deltaY / distance;
    const overlap = minDistance - distance;
    const separation = overlap * this.collision.separationFactor;

    a.pos.x -= normalX * separation;
    a.pos.y -= normalY * separation;
    b.pos.x += normalX * separation;
    b.pos.y += normalY * separation;

    const relativeX = b.vel.x - a.vel.x;
    const relativeY = b.vel.y - a.vel.y;
    const relAlongNormal = relativeX * normalX + relativeY * normalY;
    const closingSpeed = Math.max(0, -relAlongNormal);

    if (relAlongNormal < 0) {
      const impulseMagnitude = (-(1 + this.collision.restitution) * relAlongNormal) / 2;
      const impulse = impulseMagnitude * this.collision.impulseScale;
      a.vel.x -= normalX * impulse;
      a.vel.y -= normalY * impulse;
      b.vel.x += normalX * impulse;
      b.vel.y += normalY * impulse;
    }

    const tangentX = -normalY;
    const tangentY = normalX;
    const tangentialVelocity = relativeX * tangentX + relativeY * tangentY;
    if (this.collision.tangentTransfer !== 0) {
      const tangentImpulse = tangentialVelocity * this.collision.tangentTransfer;
      a.vel.x += tangentX * tangentImpulse;
      a.vel.y += tangentY * tangentImpulse;
      b.vel.x -= tangentX * tangentImpulse;
      b.vel.y -= tangentY * tangentImpulse;
    }

    if (typeof a.angVel === 'number') {
      a.angVel -= tangentialVelocity * this.collision.spinFromTangential + closingSpeed * this.collision.spinFromImpact;
      this.clampSpin(a);
    }

    if (typeof b.angVel === 'number') {
      b.angVel += tangentialVelocity * this.collision.spinFromTangential + closingSpeed * this.collision.spinFromImpact;
      this.clampSpin(b);
    }

    this.clampSpeed(a);
    this.clampSpeed(b);

    return {
      a,
      b,
      closingSpeed,
      impactStrength: closingSpeed,
      normal: { x: normalX, y: normalY },
      overlap,
      tangentialVelocity
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
