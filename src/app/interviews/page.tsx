import InterviewList from "@/app/components/InterviewList";

export default function InterviewsPage() {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 sm:mb-0">Support Engagement Interviews</h1>
        <a 
          href="/interviews/create" 
          className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md shadow-sm transition-colors font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Interview
        </a>
      </div>
      
      <InterviewList />
    </div>
  );
} 