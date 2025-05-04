# Interview Agent Development Specification

## Overview

The OpenAI Realtime Agents Interview Application is a Next.js-based web application that leverages OpenAI's Realtime API to create interactive voice-based agents for conducting structured interviews. The application specializes in qualitative research and feedback collection for startup support engagements, featuring an agent-based system that can conduct interviews following predefined conversation flows.

## Core Technologies

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL)
- **Real-time Communication**: WebSockets, RTCDataChannel
- **AI**: OpenAI Realtime API
- **Voice Processing**: WebRTC for audio streaming

## System Architecture

### Client-Server Model
- **Client**: React application that manages WebRTC connections and user interactions
- **Server**: Next.js API routes for database operations and OpenAI API interactions

### Database Structure
- **Tables**:
  - `interviews`: Stores interview metadata and session information
  - `questions`: Stores interview questions with ordinal positions
  - `answers`: Stores participant responses to questions
  - `companies`: Reference table for organization information
  - `people`: Reference table for interviewee information
  - `support_engagements`: Reference table for specific support instances

## Key Features

### 1. Agent Management
- Pre-configured agent templates with customizable conversation flows
- Dynamic agent configuration based on interview context
- Voice customization (using "shimmer" voice)
- Speech playback optimization (1.25x speed)

### 2. Interview Process
- Structured conversation states with transition rules
- Context-aware questioning based on interviewee responses
- Active listening with follow-up question generation
- Real-time transcription of conversation

### 3. Realtime Voice Interaction
- Push-to-talk functionality
- Real-time voice streaming
- Voice activity detection (semantic_vad with high eagerness)
- Audio playback controls

### 4. Data Persistence
- Interview session recording and storage
- Question and answer tracking
- Contextual metadata storage
- Support engagement linking

### 5. User Interface
- Transcript visualization
- Event logging and monitoring
- Session control and management
- Interview creation and management

## Agent Configuration

The application supports configurable interview agents with:

1. **Personality & Tone**: Professional yet friendly researcher persona
2. **Core Objectives**: Context-specific interview goals
3. **Engagement Context**: Dynamic fields for company and support information
4. **Conversation Flow**: Sequential question progression
5. **Conversation States**: Structured interview phases with transition rules
   - Introduction
   - Context questions
   - Challenge identification
   - Impact assessment
   - Conclusion

## Data Flow

1. **Interview Setup**:
   - Agent configuration loaded with contextual information
   - WebRTC connection established with OpenAI Realtime API
   - Session metadata stored in Supabase

2. **Interview Execution**:
   - Voice data streamed bidirectionally
   - Conversation transcribed in real-time
   - Responses processed by agent logic
   - Follow-up questions generated contextually

3. **Data Persistence**:
   - Interview responses stored in database
   - Metadata updated throughout session
   - Full transcript preserved

## API Endpoints

### Interview Management
- `GET /api/interviews`: Retrieve all interviews with associated questions
- `POST /api/interviews/create`: Create a new interview with questions
- `GET /api/interviews/connect`: Connect to specific interview data

### Session Management
- `GET /api/session`: Generate ephemeral keys for OpenAI Realtime API

### Data Access
- Endpoints for companies, people, and support engagements

## Deployment Considerations

- Environment variables for API keys and database connections
- WebRTC compatibility considerations
- Audio processing requirements
- Database migration scripts for schema updates

## Security

- Ephemeral key management for OpenAI API
- Server-side data validation
- Secure database access patterns
- Client-side security measures

## Future Enhancement Areas

1. **Enhanced Analytics**: Interview data visualization and insights
2. **Improved Agent Intelligence**: More contextual awareness and natural conversation
3. **Multi-language Support**: Internationalization for global usage
4. **Integration Capabilities**: API endpoints for external system connections
5. **Advanced Question Generation**: Dynamic question creation based on previous responses

## Development Guidelines

1. Follow existing code conventions in the repository
2. Maintain agent configuration patterns for consistency
3. Use TypeScript interfaces for data validation
4. Implement proper error handling for API endpoints
5. Test WebRTC functionality across different environments
6. Document new agent configurations thoroughly 