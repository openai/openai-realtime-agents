"use-client";

import React, { useState, useEffect } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useProgress } from "@/app/contexts/ProgressContext";

interface EvaluationProps {
  isVisible: boolean;
  onClose: () => void;
  customerType: string;
  onRetry: () => void;
  onNextAgent: () => void;
}

interface EvaluationResult {
  overallScore: number;
  strengths: string[];
  areasForImprovement: string[];
  specificExamples: string[];
  recommendations: string[];
  overallAssessment: string;
  problemResolutionScore: number;
  empathyScore: number;
  communicationScore: number;
  professionalismScore: number;
}

function Evaluation({ isVisible, onClose, customerType, onRetry, onNextAgent }: EvaluationProps) {
  const { transcriptItems } = useTranscript();
  const { progress, updateProgress } = useProgress();
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isVisible && transcriptItems.length > 0) {
      generateEvaluation();
    }
  }, [isVisible, transcriptItems]);

  const getAgentKey = (customerType: string) => {
    switch (customerType) {
      case 'Angry': return 'angryCustomer';
      case 'Frustrated': return 'frustratedCustomer';
      case 'Naive': return 'naiveCustomer';
      default: return 'angryCustomer';
    }
  };

  const getNextAgent = (currentAgent: string) => {
    const agents = ['angryCustomer', 'frustratedCustomer', 'naiveCustomer'];
    const currentIndex = agents.indexOf(currentAgent);
    return agents[(currentIndex + 1) % agents.length];
  };

  const analyzeConversation = (transcript: any[], customerType: string) => {
    const claimsRepMessages = transcript
      .filter(item => item.type === "MESSAGE" && item.role === "user")
      .map(item => item.title);
    
    const customerMessages = transcript
      .filter(item => item.type === "MESSAGE" && item.role === "assistant")
      .map(item => item.title);

    let problemResolutionScore = 0;
    let empathyScore = 0;
    let communicationScore = 0;
    let professionalismScore = 0;
    
    const strengths: string[] = [];
    const areasForImprovement: string[] = [];
    const specificExamples: string[] = [];
    const recommendations: string[] = [];

    // Analyze based on customer type
    if (customerType === 'Angry') {
      // Check for de-escalation techniques
      const deEscalationPhrases = claimsRepMessages.filter(msg => 
        msg.toLowerCase().includes('understand') || 
        msg.toLowerCase().includes('frustrated') ||
        msg.toLowerCase().includes('apologize') ||
        msg.toLowerCase().includes('help') ||
        msg.toLowerCase().includes('resolve')
      );
      
      if (deEscalationPhrases.length > 0) {
        empathyScore += 20;
        strengths.push("Demonstrated empathy by acknowledging customer's frustration");
        specificExamples.push(`"${deEscalationPhrases[0]}" - Good de-escalation technique`);
      } else {
        areasForImprovement.push("Failed to acknowledge customer's anger or frustration");
        empathyScore += 5;
      }

      // Check for immediate action
      const actionPhrases = claimsRepMessages.filter(msg =>
        msg.toLowerCase().includes('check') ||
        msg.toLowerCase().includes('look into') ||
        msg.toLowerCase().includes('investigate') ||
        msg.toLowerCase().includes('resolve') ||
        msg.toLowerCase().includes('fix')
      );
      
      if (actionPhrases.length > 0) {
        problemResolutionScore += 20;
        strengths.push("Took immediate action to address the customer's concerns");
        specificExamples.push(`"${actionPhrases[0]}" - Shows proactive problem-solving`);
      } else {
        areasForImprovement.push("Did not offer immediate action to resolve the issue");
        problemResolutionScore += 5;
      }

      // Check for escalation offers
      const escalationPhrases = claimsRepMessages.filter(msg =>
        msg.toLowerCase().includes('supervisor') ||
        msg.toLowerCase().includes('manager') ||
        msg.toLowerCase().includes('escalate')
      );
      
      if (escalationPhrases.length > 0) {
        professionalismScore += 15;
        strengths.push("Offered escalation when appropriate");
      } else if (customerMessages.some(msg => msg.toLowerCase().includes('supervisor'))) {
        areasForImprovement.push("Customer requested supervisor but escalation wasn't offered");
        professionalismScore += 5;
      }

    } else if (customerType === 'Frustrated') {
      // Check for understanding of repeated issues
      const historyPhrases = claimsRepMessages.filter(msg =>
        msg.toLowerCase().includes('before') ||
        msg.toLowerCase().includes('previous') ||
        msg.toLowerCase().includes('again') ||
        msg.toLowerCase().includes('history')
      );
      
      if (historyPhrases.length > 0) {
        empathyScore += 15;
        strengths.push("Acknowledged the customer's history of issues");
      } else {
        areasForImprovement.push("Did not acknowledge customer's previous experiences");
        empathyScore += 5;
      }

      // Check for root cause analysis
      const rootCausePhrases = claimsRepMessages.filter(msg =>
        msg.toLowerCase().includes('why') ||
        msg.toLowerCase().includes('cause') ||
        msg.toLowerCase().includes('reason') ||
        msg.toLowerCase().includes('investigate')
      );
      
      if (rootCausePhrases.length > 0) {
        problemResolutionScore += 20;
        strengths.push("Attempted to understand the root cause of the problem");
      } else {
        areasForImprovement.push("Did not investigate the underlying cause of the issue");
        problemResolutionScore += 5;
      }

    } else if (customerType === 'Naive') {
      // Check for clear explanations
      const explanationPhrases = claimsRepMessages.filter(msg =>
        msg.toLowerCase().includes('explain') ||
        msg.toLowerCase().includes('mean') ||
        msg.toLowerCase().includes('simple') ||
        msg.toLowerCase().includes('step') ||
        msg.toLowerCase().includes('guide')
      );
      
      if (explanationPhrases.length > 0) {
        communicationScore += 20;
        strengths.push("Provided clear explanations for the customer");
        specificExamples.push(`"${explanationPhrases[0]}" - Good explanation for new customer`);
      } else {
        areasForImprovement.push("Did not provide clear explanations for the naive customer");
        communicationScore += 5;
      }

      // Check for reassurance
      const reassurancePhrases = claimsRepMessages.filter(msg =>
        msg.toLowerCase().includes('okay') ||
        msg.toLowerCase().includes('fine') ||
        msg.toLowerCase().includes('help') ||
        msg.toLowerCase().includes('guide') ||
        msg.toLowerCase().includes('support')
      );
      
      if (reassurancePhrases.length > 0) {
        empathyScore += 15;
        strengths.push("Provided reassurance to the new customer");
      } else {
        areasForImprovement.push("Did not provide enough reassurance to the naive customer");
        empathyScore += 5;
      }
    }

    // General analysis for all customer types
    const professionalPhrases = claimsRepMessages.filter(msg =>
      msg.toLowerCase().includes('thank') ||
      msg.toLowerCase().includes('appreciate') ||
      msg.toLowerCase().includes('professional') ||
      msg.toLowerCase().includes('polite')
    );
    
    if (professionalPhrases.length > 0) {
      professionalismScore += 10;
      strengths.push("Maintained professional tone throughout the conversation");
    }

    // Check for solution offering
    const solutionPhrases = claimsRepMessages.filter(msg =>
      msg.toLowerCase().includes('solution') ||
      msg.toLowerCase().includes('option') ||
      msg.toLowerCase().includes('alternative') ||
      msg.toLowerCase().includes('can do') ||
      msg.toLowerCase().includes('offer')
    );
    
    if (solutionPhrases.length > 0) {
      problemResolutionScore += 15;
      strengths.push("Offered specific solutions to the customer's problem");
    } else {
      areasForImprovement.push("Did not offer specific solutions to the customer's problem");
      problemResolutionScore += 5;
    }

    // Check for follow-up
    const followUpPhrases = claimsRepMessages.filter(msg =>
      msg.toLowerCase().includes('follow up') ||
      msg.toLowerCase().includes('call back') ||
      msg.toLowerCase().includes('contact') ||
      msg.toLowerCase().includes('update')
    );
    
    if (followUpPhrases.length > 0) {
      professionalismScore += 10;
      strengths.push("Offered follow-up to ensure resolution");
    } else {
      areasForImprovement.push("Did not offer follow-up to ensure customer satisfaction");
      professionalismScore += 5;
    }

    // Calculate overall score
    const overallScore = Math.round((problemResolutionScore + empathyScore + communicationScore + professionalismScore) / 4);

    // Generate recommendations based on scores
    if (problemResolutionScore < 15) {
      recommendations.push("Focus on offering specific solutions rather than just acknowledging problems");
    }
    if (empathyScore < 15) {
      recommendations.push("Practice active listening and acknowledge customer emotions more");
    }
    if (communicationScore < 15) {
      recommendations.push("Work on providing clearer explanations and avoiding jargon");
    }
    if (professionalismScore < 15) {
      recommendations.push("Maintain professional tone and offer appropriate follow-up");
    }

    // Add general recommendations
    recommendations.push("Practice with different customer types to improve adaptability");
    recommendations.push("Review successful conversations to identify effective techniques");

    return {
      overallScore,
      problemResolutionScore,
      empathyScore,
      communicationScore,
      professionalismScore,
      strengths: strengths.length > 0 ? strengths : ["Maintained basic professionalism"],
      areasForImprovement: areasForImprovement.length > 0 ? areasForImprovement : ["Could improve overall customer service skills"],
      specificExamples: specificExamples.length > 0 ? specificExamples : ["No specific examples available"],
      recommendations,
      overallAssessment: `This was a ${customerType.toLowerCase()} customer interaction. The claims rep ${overallScore >= 70 ? 'demonstrated good skills' : 'needs improvement'} in handling this type of customer. ${overallScore >= 80 ? 'Overall performance was strong' : overallScore >= 60 ? 'There are clear areas for improvement' : 'Significant improvement needed'}.`
    };
  };

  const generateEvaluation = async () => {
    setIsLoading(true);
    
    try {
      // Analyze the actual conversation
      const evaluationResult = analyzeConversation(transcriptItems, customerType);
      
      // Only update progress if we have a real evaluation
      if (evaluationResult && evaluationResult.overallScore > 0) {
        const agentKey = getAgentKey(customerType);
        updateProgress(agentKey, evaluationResult.overallScore);
      }
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setEvaluation(evaluationResult);
    } catch (error) {
      console.error('Error generating evaluation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Satisfactory';
    if (score >= 60) return 'Needs Improvement';
    return 'Unsatisfactory';
  };

  const isPassed = evaluation?.overallScore ? evaluation.overallScore >= 80 : false;
  const agentKey = getAgentKey(customerType);
  const agentProgress = progress[agentKey as keyof typeof progress];

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Conversation Evaluation</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing your conversation with the {customerType.toLowerCase()} customer...</p>
          </div>
        ) : evaluation ? (
          <div className="space-y-6">
            {/* Pass/Fail Status */}
            <div className={`p-4 rounded-lg ${isPassed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-3">
                {isPassed ? (
                  <div className="text-green-600 text-2xl">✅</div>
                ) : (
                  <div className="text-red-600 text-2xl">❌</div>
                )}
                <div>
                  <h3 className={`text-lg font-semibold ${isPassed ? 'text-green-800' : 'text-red-800'}`}>
                    {isPassed ? 'PASSED!' : 'NEEDS IMPROVEMENT'}
                  </h3>
                  <p className={`text-sm ${isPassed ? 'text-green-700' : 'text-red-700'}`}>
                    {isPassed 
                      ? `Congratulations! You've successfully handled the ${customerType.toLowerCase()} customer.`
                      : `You need a score of 80 or higher to pass. Keep practicing!`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Overall Score */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Overall Score</h3>
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${getScoreColor(evaluation.overallScore)}`}>
                  {evaluation.overallScore}/100
                </div>
                <div className={`text-lg font-medium ${getScoreColor(evaluation.overallScore)}`}>
                  {getScoreLabel(evaluation.overallScore)}
                </div>
              </div>
              {agentProgress.attempts > 1 && (
                <p className="text-sm text-gray-600 mt-2">
                  Best score: {agentProgress.bestScore}/100 (Attempt {agentProgress.attempts})
                </p>
              )}
            </div>

            {/* Detailed Scores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-3 rounded">
                <h4 className="font-semibold text-blue-800">Problem Resolution</h4>
                <div className={`text-lg font-bold ${getScoreColor(evaluation.problemResolutionScore)}`}>
                  {evaluation.problemResolutionScore}/25
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <h4 className="font-semibold text-green-800">Empathy</h4>
                <div className={`text-lg font-bold ${getScoreColor(evaluation.empathyScore)}`}>
                  {evaluation.empathyScore}/25
                </div>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <h4 className="font-semibold text-purple-800">Communication</h4>
                <div className={`text-lg font-bold ${getScoreColor(evaluation.communicationScore)}`}>
                  {evaluation.communicationScore}/25
                </div>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <h4 className="font-semibold text-orange-800">Professionalism</h4>
                <div className={`text-lg font-bold ${getScoreColor(evaluation.professionalismScore)}`}>
                  {evaluation.professionalismScore}/25
                </div>
              </div>
            </div>

            {/* Strengths */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-green-700">Strengths</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {evaluation.strengths.map((strength, index) => (
                  <li key={index}>{strength}</li>
                ))}
              </ul>
            </div>

            {/* Areas for Improvement */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-orange-700">Areas for Improvement</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {evaluation.areasForImprovement.map((area, index) => (
                  <li key={index}>{area}</li>
                ))}
              </ul>
            </div>

            {/* Specific Examples */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-blue-700">Specific Examples</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                {evaluation.specificExamples.map((example, index) => (
                  <li key={index} className="bg-gray-50 p-2 rounded">
                    {example}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-purple-700">Recommendations</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {evaluation.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>

            {/* Overall Assessment */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 text-blue-800">Overall Assessment</h3>
              <p className="text-gray-700">{evaluation.overallAssessment}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Close
              </button>
              {!isPassed && (
                <button
                  onClick={onRetry}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                >
                  Try Again
                </button>
              )}
              {isPassed && (
                <button
                  onClick={onNextAgent}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Next Customer Type
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Print Report
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            No evaluation available
          </div>
        )}
      </div>
    </div>
  );
}

export default Evaluation; 