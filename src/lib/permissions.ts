export interface UserPermissionsData {
  hasMembership: boolean;
  isAdmin: boolean;
  isPartner: boolean;
  purchasedSlugs: string[];
}

export class PermissionsService {
  private data: UserPermissionsData;

  constructor(data: UserPermissionsData) {
    this.data = {
      hasMembership: data.hasMembership || false,
      isAdmin: data.isAdmin || false,
      isPartner: data.isPartner || false,
      purchasedSlugs: (data.purchasedSlugs || []).map(s => s.toLowerCase()),
    };
  }

  /**
   * Has the user bought the "Gesamtpaket" or do they have manual full membership access?
   */
  hasFullAccess(): boolean {
    if (this.data.isAdmin) return true; // Admins see everything
    if (this.data.hasMembership) return true;
    return this.data.purchasedSlugs.includes('gesamtpaket') || 
           this.data.purchasedSlugs.includes('gesamt');
  }

  /**
   * Does the user have access to a specific module (e.g. 'grundlagen', 'spezial')?
   */
  hasModuleAccess(moduleName: string): boolean {
    if (!moduleName) return false;
    if (this.hasFullAccess()) return true;
    
    const lowerName = moduleName.toLowerCase();
    
    if (lowerName.includes('spezial') && 
       (this.data.purchasedSlugs.includes('spezial') || this.data.purchasedSlugs.includes('spezialthemen-modul'))) {
      return true;
    }
    if (lowerName.includes('grundlagen') && 
       (this.data.purchasedSlugs.includes('grundlagen') || this.data.purchasedSlugs.includes('grundlagen-modul'))) {
      return true;
    }
    if (lowerName.includes('praktiker') && 
       (this.data.purchasedSlugs.includes('praktiker') || this.data.purchasedSlugs.includes('praktiker-modul'))) {
      return true;
    }

    return false;
  }

  /**
   * Can the user watch a specific video based on its slug or its parent module?
   */
  canAccessVideo(videoSlug: string, videoModuleName?: string): boolean {
    if (this.hasFullAccess()) return true;
    
    // Explicit single-video purchase check
    if (videoSlug && this.data.purchasedSlugs.includes(videoSlug.toLowerCase())) {
      return true;
    }

    // Module blanket access check
    if (videoModuleName && this.hasModuleAccess(videoModuleName)) {
      return true;
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
    
    return this.data.purchasedSlugs.some(slug => 
      ['grundlagen', 'grundlagen-modul', 'spezial', 'spezialthemen', 'spezialthemen-modul', 'praktiker', 'praktiker-modul'].includes(slug)
    );
  }

  /**
   * Quick check for literal slug purchase (useful for UI constraints and specific checks)
   */
  hasExactSlug(slug: string): boolean {
    if (!slug) return false;
    return this.data.purchasedSlugs.includes(slug.toLowerCase());
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
    purchasedSlugs: purchasesRows ? purchasesRows.map(p => p.video_slug) : []
  });
}
