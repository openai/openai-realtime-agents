// src/app/simple/services/LocalStorageService.ts
/**
 * Classe para gerenciar o armazenamento local
 */
export class LocalStorageService {
  private prefix: string = 'itau_consignado_';
  
  /**
   * Armazena um valor no localStorage
   * @param key Chave do item
   * @param value Valor a ser armazenado
   */
  setItem(key: string, value: any): void {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(this.prefix + key, serializedValue);
    } catch (err) {
      console.error(`Error storing item "${key}":`, err);
    }
  }
  
  /**
   * Recupera um valor do localStorage
   * @param key Chave do item
   * @param defaultValue Valor padrão se o item não existir
   * @returns Valor armazenado ou valor padrão
   */
  getItem<T>(key: string, defaultValue: T): T {
    try {
      const value = localStorage.getItem(this.prefix + key);
      if (value === null) return defaultValue;
      
      try {
        // Tenta converter para JSON
        return JSON.parse(value) as T;
      } catch {
        // Se falhar, retorna como string
        return value as unknown as T;
      }
    } catch (err) {
      console.error(`Error retrieving item "${key}":`, err);
      return defaultValue;
    }
  }
  
  /**
   * Remove um item do localStorage
   * @param key Chave do item
   */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (err) {
      console.error(`Error removing item "${key}":`, err);
    }
  }
  
  /**
   * Verifica se um item existe no localStorage
   * @param key Chave do item
   * @returns Verdadeiro se o item existir
   */
  hasItem(key: string): boolean {
    try {
      return localStorage.getItem(this.prefix + key) !== null;
    } catch (err) {
      console.error(`Error checking item "${key}":`, err);
      return false;
    }
  }
  
  /**
   * Limpa todos os itens do aplicativo do localStorage
   */
  clear(): void {
    try {
      // Remove apenas as chaves com o prefixo do aplicativo
      Object.keys(localStorage)
        .filter(key => key.startsWith(this.prefix))
        .forEach(key => localStorage.removeItem(key));
    } catch (err) {
      console.error('Error clearing storage:', err);
    }
  }
  
  /**
   * Salva as preferências do usuário
   * @param preferences Objeto com as preferências
   */
  savePreferences(preferences: Record<string, any>): void {
    this.setItem('user_preferences', preferences);
  }
  
  /**
   * Recupera as preferências do usuário
   * @returns Objeto com as preferências
   */
  getPreferences(): Record<string, any> {
    return this.getItem<Record<string, any>>('user_preferences', {});
  }
}

// Exporta uma instância singleton
export const localStorageService = new LocalStorageService();