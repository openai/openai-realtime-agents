// src/app/simple/utils/errorHandling.ts
/**
 * Função para tratamento padronizado de erros
 * @param error O erro capturado
 * @param context Contexto onde o erro ocorreu
 * @param fallbackAction Ação opcional a ser executada em caso de erro
 * @returns Objeto com informações do erro
 */
export const handleError = (
  error: any, 
  context: string, 
  fallbackAction?: () => void
): { error: boolean; message: string; details?: any } => {
  // Registrar o erro no console
  console.error(`Error in ${context}:`, error);
  
  // Informações adicionais em ambiente de desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    console.debug('Error details:', {
      name: error?.name,
      stack: error?.stack,
      context
    });
  }
  
  // Executar ação de fallback, se fornecida
  if (fallbackAction) {
    try {
      fallbackAction();
    } catch (fallbackError) {
      console.error(`Error in fallback action for ${context}:`, fallbackError);
    }
  }
  
  // Retornar informações padronizadas
  return {
    error: true,
    message: `Erro ao ${context.toLowerCase()}`,
    details: process.env.NODE_ENV !== 'production' ? error : undefined
  };
};

/**
 * Wrapper de função assíncrona com tratamento de erro padronizado
 * @param asyncFn Função assíncrona a ser executada
 * @param context Contexto da operação
 * @param fallbackAction Ação opcional a ser executada em caso de erro
 * @returns Resultado da função ou objeto de erro
 */
export const safeAsync = async <T>(
  asyncFn: () => Promise<T>,
  context: string,
  fallbackAction?: () => void
): Promise<T | { error: boolean; message: string; details?: any }> => {
  try {
    return await asyncFn();
  } catch (error) {
    return handleError(error, context, fallbackAction);
  }
};

/**
 * Verifica se um objeto é um resultado de erro
 * @param result Objeto a ser verificado
 * @returns Verdadeiro se for um resultado de erro
 */
export const isErrorResult = (result: any): result is { error: boolean; message: string } => {
  return result && typeof result === 'object' && result.error === true && typeof result.message === 'string';
};