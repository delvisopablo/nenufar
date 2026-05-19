import { Injectable, signal } from '@angular/core';
import {
  ReviewProductChip,
  SuggestedReviewProduct,
} from '../../core/reviews/review-products';

export type PondBusinessSnapshot = {
  id: number;
  nombre?: string;
  slug?: string | null;
  nickname?: string | null;
  duenoId?: number | null;
  categoria?: { id?: number; nombre?: string } | string | null;
  ciudad?: string | null;
  provincia?: string | null;
  descripcion?: string | null;
  foto?: string | null;
  fotoPerfil?: string | null;
  fotoPortada?: string | null;
  imagenNenufar?: string | null;
  nenufarActivo?: string | null;
  assetNenufar?: string | null;
  nenufarColor?: string | null;
  nenufarKey?: string | null;
  nenufarAsset?: string | null;
  verificado?: boolean;
  isFollowing?: boolean;
  isFollowedByMe?: boolean;
  followersCount?: number;
};

export type PondReviewAnnouncement = {
  id: number;
  negocioId: number;
  postId?: number | null;
  likesCount?: number;
  likedByMe?: boolean;
  comentariosCount?: number;
  contenido: string;
  puntuacion: number;
  selloNenufar: boolean;
  fechaISO: string;
  autorNombre?: string;
  usuarioNickname?: string;
  usuarioFoto?: string | null;
  productoNombre?: string | null;
  productos?: ReviewProductChip[];
  productosSugeridos?: SuggestedReviewProduct[];
  negocio?: PondBusinessSnapshot | null;
};

export type PondPromotionAnnouncement = {
  id: number;
  negocioId: number;
  titulo: string;
  descripcion?: string | null;
  descuento?: number;
  tipoDescuento?: string;
  fechaInicio?: string | null;
  fechaCaducidad?: string | null;
  activa?: boolean;
  estado?: string | null;
  codigo?: string | null;
  creadoEnISO?: string | null;
  negocioNombre?: string | null;
  negocio?: PondBusinessSnapshot | null;
};

function upsertById<T extends { id: number }>(items: T[], nextItem: T): T[] {
  const next = items.filter((item) => item.id !== nextItem.id);
  next.unshift(nextItem);
  return next;
}

@Injectable({ providedIn: 'root' })
export class EstanqueFeedService {
  private readonly reviewAnnouncementsSignal = signal<PondReviewAnnouncement[]>([]);
  private readonly promotionAnnouncementsSignal = signal<PondPromotionAnnouncement[]>([]);

  readonly reviewAnnouncements = this.reviewAnnouncementsSignal.asReadonly();
  readonly promotionAnnouncements = this.promotionAnnouncementsSignal.asReadonly();

  announceReview(review: PondReviewAnnouncement): void {
    this.reviewAnnouncementsSignal.update((items) => upsertById(items, review));
  }

  announcePromotion(promotion: PondPromotionAnnouncement): void {
    this.promotionAnnouncementsSignal.update((items) => upsertById(items, promotion));
  }

  clearReviews(ids: number[]): void {
    if (!ids.length) {
      return;
    }

    const idSet = new Set(ids);
    this.reviewAnnouncementsSignal.update((items) =>
      items.filter((item) => !idSet.has(item.id)),
    );
  }

  clearPromotions(ids: number[]): void {
    if (!ids.length) {
      return;
    }

    const idSet = new Set(ids);
    this.promotionAnnouncementsSignal.update((items) =>
      items.filter((item) => !idSet.has(item.id)),
    );
  }
}
