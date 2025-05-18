#!/bin/bash

# Definir diretório base
BASE_DIR="src/app/simple"

# Criar diretório base (se não existir)
mkdir -p $BASE_DIR

# Criar estrutura de diretórios
mkdir -p $BASE_DIR/components
mkdir -p $BASE_DIR/contexts
mkdir -p $BASE_DIR/hooks
mkdir -p $BASE_DIR/services
mkdir -p $BASE_DIR/machines
mkdir -p $BASE_DIR/utils

# Criar arquivos de componentes (vazios)
touch $BASE_DIR/components/PhoneMockup.tsx
touch $BASE_DIR/components/StatusBar.tsx
touch $BASE_DIR/components/BrowserNavbar.tsx
touch $BASE_DIR/components/CameraView.tsx
touch $BASE_DIR/components/VerificationProgress.tsx
touch $BASE_DIR/components/PushToTalkButton.tsx
touch $BASE_DIR/components/AnimatedFooter.tsx

# Criar arquivos de contextos
touch $BASE_DIR/contexts/ConnectionContext.tsx
touch $BASE_DIR/contexts/CameraContext.tsx
touch $BASE_DIR/contexts/VerificationContext.tsx
touch $BASE_DIR/contexts/UIContext.tsx

# Criar arquivos de hooks
touch $BASE_DIR/hooks/useWebRTCConnection.ts
touch $BASE_DIR/hooks/useCamera.ts
touch $BASE_DIR/hooks/useAudioAnalysis.ts
touch $BASE_DIR/hooks/useVerificationProcess.ts

# Criar arquivos de serviços
touch $BASE_DIR/services/AgentService.ts
touch $BASE_DIR/services/AudioService.ts
touch $BASE_DIR/services/LocalStorageService.ts

# Criar arquivos de máquinas de estado
touch $BASE_DIR/machines/verificationMachine.ts

# Criar arquivos de utilitários
touch $BASE_DIR/utils/errorHandling.ts
touch $BASE_DIR/utils/formatting.ts

# Criar arquivos principais
touch $BASE_DIR/page.tsx
touch $BASE_DIR/types.ts

echo "Estrutura de diretórios criada com sucesso em $BASE_DIR"

