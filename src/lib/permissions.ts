export interface UserPurchase {
  slug: string;
  purchasedAt: Date;
}

export interface UserPermissionsData {
  hasMembership: boolean;
  isAdmin: boolean;
  isPartner: boolean;
  purchases: UserPurchase[];
}

export class PermissionsService {
  private data: UserPermissionsData;

  constructor(data: UserPermissionsData) {
    this.data = {
      hasMembership: data.hasMembership || false,
      isAdmin: data.isAdmin || false,
      isPartner: data.isPartner || false,
      purchases: (data.purchases || []).map(p => ({
        slug: p.slug.toLowerCase(),
        purchasedAt: new Date(p.purchasedAt)
      })),
    };
  }

  /**
   * Has the user bought the "Gesamtpaket" or do they have manual full membership access?
   */
  hasFullAccess(): boolean {
    if (this.data.isAdmin) return true; // Admins see everything
    if (this.data.hasMembership) return true;
    return this.data.purchases.some(p => p.slug === 'gesamtpaket' || p.slug === 'gesamt');
  }

  /**
   * Does the user have access to a specific module (e.g. 'grundlagen', 'spezial')?
   */
  hasModuleAccess(moduleName: string): boolean {
    if (!moduleName) return false;
    if (this.hasFullAccess()) return true;
    
    const lowerName = moduleName.toLowerCase();
    
    if (lowerName.includes('spezial') && 
       this.data.purchases.some(p => p.slug === 'spezial' || p.slug === 'spezialthemen-modul')) {
      return true;
    }
    if (lowerName.includes('grundlagen') && 
       this.data.purchases.some(p => p.slug === 'grundlagen' || p.slug === 'grundlagen-modul')) {
      return true;
    }
    if (lowerName.includes('praktiker') && 
       this.data.purchases.some(p => p.slug === 'praktiker' || p.slug === 'praktiker-modul')) {
      return true;
    }

    return false;
  }

  /**
   * Can the user watch a specific video based on its slug or its parent module?
   */
  canAccessVideo(videoSlug: string, videoModuleName?: string, eventDateStr?: string | Date): boolean {
    if (this.hasFullAccess()) return true;

    // Module blanket access check (Modules don't expire)
    if (videoModuleName && this.hasModuleAccess(videoModuleName)) {
      return true;
    }
    
    // Explicit single-video purchase check
    if (videoSlug) {
      const purchase = this.data.purchases.find(p => p.slug === videoSlug.toLowerCase());
      if (purchase) {
        // Enforce 14-day validity for external individual video purchases
        let startDate = purchase.purchasedAt;
        
        // If the user bought the ticket BEFORE the live event happened, 
        // the 14 days begin on the eventDate, not on the purchase date!
        if (eventDateStr) {
           const eventD = new Date(eventDateStr);
           if (startDate < eventD) {
              startDate = eventD;
           }
        }
        
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        
        if (startDate >= fourteenDaysAgo) {
          return true; // Still within 14 days from the anchor date
        }
      }
    }

    return false;
  }

  /**
   * Is this user considered a "Member" (for Forum access and specific Member benefits)?
   * A member is someone who owns at least one module (or the overall membership).
   * Buying a *single video* does NOT make them a member.
   */
  isMember(): boolean {
    if (this.hasFullAccess()) return true;
    
    return this.data.purchases.some(p => 
      ['grundlagen', 'grundlagen-modul', 'spezial', 'spezialthemen', 'spezialthemen-modul', 'praktiker', 'praktiker-modul'].includes(p.slug)
    );
  }

  /**
   * Quick check for literal slug purchase (useful for UI constraints and specific checks)
   */
  hasExactSlug(slug: string, eventDateStr?: string | Date): boolean {
    if (!slug) return false;
    
    const purchase = this.data.purchases.find(p => p.slug === slug.toLowerCase());
    if (!purchase) return false;
    
    let startDate = purchase.purchasedAt;
    if (eventDateStr) {
       const eventD = new Date(eventDateStr);
       if (startDate < eventD) {
          startDate = eventD;
       }
    }
    
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    // Exact slug blocks should be lifted if the purchase is expired, so they can re-buy!
    return startDate >= fourteenDaysAgo;
  }
}

/**
 * Convenience helper to initialize the permissions object from raw DB outputs
 */
export function buildPermissions(profileRow: any, purchasesRows: any[]): PermissionsService {
  return new PermissionsService({
    hasMembership: profileRow?.has_membership === true,
    isAdmin: profileRow?.is_admin === true,
    isPartner: profileRow?.is_partner === true,
    purchases: purchasesRows ? purchasesRows.map(p => ({
      slug: p.video_slug,
      purchasedAt: new Date(p.created_at || Date.now())
    })) : []
  });
}
