/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suas configurações existentes...
  
  // Adicionar esta configuração para permitir o carregamento dos modelos
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    return config;
  },
  
  // Importante para permitir o acesso aos modelos
  async headers() {
    return [
      {
        source: '/models/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
