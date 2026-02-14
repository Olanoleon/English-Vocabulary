"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, ChevronRight, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
}

interface MatchingPair {
  word: string;
  definition: string;
  spanish: string;
}

interface Question {
  id: string;
  type: string;
  prompt: string;
  correctAnswer: string | null;
  options: QuestionOption[];
}

interface SectionData {
  id: string;
  title: string;
  titleEs: string;
  modules: {
    id: string;
    type: string;
    questions: Question[];
  }[];
}

const PAIR_COLORS = [
  { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-700" },
  { bg: "bg-purple-100", border: "border-purple-400", text: "text-purple-700" },
  { bg: "bg-amber-100", border: "border-amber-400", text: "text-amber-700" },
  { bg: "bg-teal-100", border: "border-teal-400", text: "text-teal-700" },
  { bg: "bg-rose-100", border: "border-rose-400", text: "text-rose-700" },
];

export default function PracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [section, setSection] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [fillAnswer, setFillAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<
    { questionId: string; selectedOptionId?: string; answerText?: string }[]
  >([]);

  // Matching question state
  const [matchingSelectedWord, setMatchingSelectedWord] = useState<number | null>(null);
  const [matchingPairedMap, setMatchingPairedMap] = useState<Record<number, number>>({});
  const [matchingDefOrder, setMatchingDefOrder] = useState<number[]>([]);
  const [matchingResults, setMatchingResults] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchSection() {
    const res = await fetch(`/api/learn/sections/${id}`);
    if (res.ok) {
      setSection(await res.json());
    }
    setLoading(false);
  }

  const practiceModule = section?.modules.find((m) => m.type === "practice");
  const questions = practiceModule?.questions || [];
  const currentQuestion = questions[currentIndex];

  // Parse matching pairs for the current question
  const matchingPairsData: MatchingPair[] = (() => {
    if (currentQuestion?.type !== "matching" || !currentQuestion.correctAnswer) return [];
    try { return JSON.parse(currentQuestion.correctAnswer); } catch { return []; }
  })();

  // Initialize shuffled definition order when a matching question loads
  const initMatchingOrder = useCallback((pairCount: number) => {
    const indices = Array.from({ length: pairCount }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setMatchingDefOrder(indices);
    setMatchingSelectedWord(null);
    setMatchingPairedMap({});
    setMatchingResults({});
  }, []);

  useEffect(() => {
    if (currentQuestion?.type === "matching" && matchingPairsData.length > 0) {
      initMatchingOrder(matchingPairsData.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Matching: tap a word
  function onMatchingWordTap(wordIdx: number) {
    if (revealed) return;
    if (matchingPairedMap[wordIdx] !== undefined) {
      // Unpair
      const newMap = { ...matchingPairedMap };
      delete newMap[wordIdx];
      setMatchingPairedMap(newMap);
      setMatchingSelectedWord(null);
    } else {
      setMatchingSelectedWord(wordIdx === matchingSelectedWord ? null : wordIdx);
    }
  }

  // Matching: tap a definition
  function onMatchingDefTap(defIdx: number) {
    if (revealed || matchingSelectedWord === null) return;
    // If this definition is already paired to another word, unpair that word
    const newMap = { ...matchingPairedMap };
    for (const [wIdx, dIdx] of Object.entries(newMap)) {
      if (dIdx === defIdx) delete newMap[Number(wIdx)];
    }
    newMap[matchingSelectedWord] = defIdx;
    setMatchingPairedMap(newMap);
    setMatchingSelectedWord(null);
  }

  // Get the color assigned to a paired word
  function getPairColor(wordIdx: number) {
    return PAIR_COLORS[wordIdx % PAIR_COLORS.length];
  }

  // Check if all pairs are matched
  const allMatchingPaired = matchingPairsData.length > 0 &&
    Object.keys(matchingPairedMap).length === matchingPairsData.length;

  function checkAnswer() {
    if (!currentQuestion) return;

    let correct = false;
    const answer: {
      questionId: string;
      selectedOptionId?: string;
      answerText?: string;
    } = { questionId: currentQuestion.id };

    if (currentQuestion.type === "matching") {
      // Build learner pairing map: word -> definition
      const learnerPairings: Record<string, string> = {};
      let correctPairs = 0;
      for (const [wIdxStr, dIdx] of Object.entries(matchingPairedMap)) {
        const wIdx = Number(wIdxStr);
        const word = matchingPairsData[wIdx]?.word || "";
        const chosenDef = matchingPairsData[dIdx]?.definition || "";
        learnerPairings[word] = chosenDef;
        const isMatch = wIdx === dIdx;
        if (isMatch) correctPairs++;
        setMatchingResults((prev) => ({ ...prev, [wIdx]: isMatch }));
      }
      answer.answerText = JSON.stringify(learnerPairings);
      // Score: each correct pair = 1 point
      setScore((prev) => ({
        correct: prev.correct + correctPairs,
        total: prev.total + matchingPairsData.length,
      }));
      correct = correctPairs === matchingPairsData.length;
    } else if (currentQuestion.type === "fill_blank") {
      correct =
        fillAnswer.toLowerCase().trim() ===
        currentQuestion.correctAnswer?.toLowerCase().trim();
      answer.answerText = fillAnswer;
      setScore((prev) => ({
        correct: prev.correct + (correct ? 1 : 0),
        total: prev.total + 1,
      }));
    } else {
      const selectedOpt = currentQuestion.options.find(
        (o) => o.id === selectedOption
      );
      correct = selectedOpt?.isCorrect || false;
      answer.selectedOptionId = selectedOption || undefined;
      setScore((prev) => ({
        correct: prev.correct + (correct ? 1 : 0),
        total: prev.total + 1,
      }));
    }

    setIsCorrect(correct);
    setRevealed(true);
    setAnswers((prev) => [...prev, answer]);
  }

  function nextQuestion() {
    if (currentIndex + 1 >= questions.length) {
      finishPractice();
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setFillAnswer("");
    setRevealed(false);
    setIsCorrect(null);
  }

  async function finishPractice() {
    setFinished(true);
    if (practiceModule) {
      await fetch("/api/learn/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: practiceModule.id,
          answers,
        }),
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!section || questions.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push(`/learn/sections/${id}`)}
            className="p-1 -ml-1 text-gray-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-sm">Practice</h1>
            {section?.titleEs && <p className="text-xs text-gray-400">{section.titleEs}</p>}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-500">
              No practice questions available yet.
            </p>
            <button
              onClick={() => router.push(`/learn/sections/${id}`)}
              className="mt-4 bg-primary-600 text-white px-6 py-2 rounded-xl text-sm font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Finished screen
  if (finished) {
    const percentage =
      score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="animate-scale-in text-center">
          <div
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
              percentage >= 80 ? "bg-success-500" : "bg-warning-500"
            )}
          >
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Practice Complete!
          </h2>
          <p className="text-gray-500 mt-2">
            You got {score.correct} out of {score.total} correct
          </p>
          <div className="text-4xl font-bold text-primary-600 mt-4">
            {percentage}%
          </div>

          <div className="mt-8 space-y-3 w-full">
            <button
              onClick={() => router.push(`/learn/sections/${id}`)}
              className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
            >
              Continue
            </button>
            <button
              onClick={() => {
                setCurrentIndex(0);
                setScore({ correct: 0, total: 0 });
                setFinished(false);
                setRevealed(false);
                setSelectedOption(null);
                setFillAnswer("");
                setAnswers([]);
                setIsCorrect(null);
                setMatchingSelectedWord(null);
                setMatchingPairedMap({});
                setMatchingDefOrder([]);
                setMatchingResults({});
              }}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Practice Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button
          onClick={() => router.push(`/learn/sections/${id}`)}
          className="p-1 -ml-1 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-sm">Practice</h1>
          <p className="text-xs text-gray-400">
            {section.titleEs} · {currentIndex + 1} / {questions.length}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-primary-600 transition-all duration-300"
          style={{
            width: `${((currentIndex + 1) / questions.length) * 100}%`,
          }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 px-4 py-6" key={currentIndex}>
        <div className="animate-slide-in">
          <span className="inline-block bg-primary-50 text-primary-600 text-xs font-medium px-2.5 py-1 rounded-full mb-4 capitalize">
            {currentQuestion.type.replace("_", " ")}
          </span>

          <h2 className="text-lg font-bold text-gray-900 mb-6">
            {currentQuestion.prompt}
          </h2>

          {/* Multiple Choice / Phonetics */}
          {(currentQuestion.type === "multiple_choice" ||
            currentQuestion.type === "phonetics") && (
            <div className="space-y-3">
              {currentQuestion.options.map((option) => {
                let optionStyle = "border-gray-200 bg-white hover:border-primary-300";
                if (revealed) {
                  if (option.isCorrect) {
                    optionStyle = "border-success-500 bg-green-50";
                  } else if (
                    option.id === selectedOption &&
                    !option.isCorrect
                  ) {
                    optionStyle = "border-danger-500 bg-red-50";
                  } else {
                    optionStyle = "border-gray-100 bg-gray-50 opacity-50";
                  }
                } else if (option.id === selectedOption) {
                  optionStyle = "border-primary-500 bg-primary-50";
                }

                return (
                  <button
                    key={option.id}
                    onClick={() => !revealed && setSelectedOption(option.id)}
                    disabled={revealed}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium",
                      optionStyle
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option.optionText}</span>
                      {revealed && option.isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0" />
                      )}
                      {revealed &&
                        option.id === selectedOption &&
                        !option.isCorrect && (
                          <XCircle className="w-5 h-5 text-danger-500 flex-shrink-0" />
                        )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Fill in the Blank */}
          {currentQuestion.type === "fill_blank" && (
            <div>
              <input
                type="text"
                value={fillAnswer}
                onChange={(e) => setFillAnswer(e.target.value)}
                disabled={revealed}
                placeholder="Type your answer..."
                className={cn(
                  "w-full px-4 py-3 border-2 rounded-xl text-lg focus:outline-none transition-colors",
                  revealed
                    ? isCorrect
                      ? "border-success-500 bg-green-50"
                      : "border-danger-500 bg-red-50"
                    : "border-gray-200 focus:border-primary-500"
                )}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !revealed && fillAnswer.trim()) {
                    checkAnswer();
                  }
                }}
              />
              {revealed && !isCorrect && (
                <p className="mt-2 text-sm text-success-600 font-medium">
                  Correct answer: {currentQuestion.correctAnswer}
                </p>
              )}
            </div>
          )}

          {/* Matching */}
          {currentQuestion.type === "matching" && matchingPairsData.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" />
                Tap a word, then tap its definition to pair them
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* Left column: Words */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Words</div>
                  {matchingPairsData.map((pair, wIdx) => {
                    const isPaired = matchingPairedMap[wIdx] !== undefined;
                    const isSelected = matchingSelectedWord === wIdx;
                    const color = isPaired ? getPairColor(wIdx) : null;
                    const result = matchingResults[wIdx];
                    let style = "border-gray-200 bg-white";
                    if (revealed && result !== undefined) {
                      style = result ? "border-success-500 bg-green-50" : "border-danger-500 bg-red-50";
                    } else if (isPaired && color) {
                      style = `${color.border} ${color.bg}`;
                    } else if (isSelected) {
                      style = "border-primary-500 bg-primary-50 ring-2 ring-primary-200";
                    }
                    return (
                      <button
                        key={wIdx}
                        onClick={() => onMatchingWordTap(wIdx)}
                        disabled={revealed}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all text-sm font-semibold",
                          style
                        )}
                      >
                        <span>{pair.word}</span>
                        {isPaired && !revealed && (
                          <span className="ml-1 text-xs opacity-50">✓</span>
                        )}
                        {revealed && result === true && (
                          <CheckCircle2 className="w-4 h-4 text-success-500 inline ml-1" />
                        )}
                        {revealed && result === false && (
                          <XCircle className="w-4 h-4 text-danger-500 inline ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Right column: Definitions (shuffled) */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Definitions</div>
                  {matchingDefOrder.map((defIdx) => {
                    const pair = matchingPairsData[defIdx];
                    // Find if this definition is paired to a word
                    const pairedWordIdx = Object.entries(matchingPairedMap).find(
                      ([, dIdx]) => dIdx === defIdx
                    )?.[0];
                    const isPaired = pairedWordIdx !== undefined;
                    const color = isPaired ? getPairColor(Number(pairedWordIdx)) : null;
                    const result = isPaired ? matchingResults[Number(pairedWordIdx)] : undefined;
                    let style = "border-gray-200 bg-white";
                    if (revealed && result !== undefined) {
                      style = result ? "border-success-500 bg-green-50" : "border-danger-500 bg-red-50";
                    } else if (isPaired && color) {
                      style = `${color.border} ${color.bg}`;
                    } else if (matchingSelectedWord !== null && !isPaired) {
                      style = "border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50";
                    }
                    return (
                      <button
                        key={defIdx}
                        onClick={() => onMatchingDefTap(defIdx)}
                        disabled={revealed || matchingSelectedWord === null}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all text-xs",
                          style
                        )}
                      >
                        <div className="font-medium text-gray-800 leading-snug">{pair.definition}</div>
                        <div className="text-gray-400 mt-0.5 italic">{pair.spanish}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Show correct pairings for incorrect matches after reveal */}
              {revealed && Object.values(matchingResults).some((r) => !r) && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs space-y-1">
                  <p className="font-semibold text-danger-600">Correct pairings:</p>
                  {matchingPairsData.map((pair, idx) =>
                    matchingResults[idx] === false ? (
                      <p key={idx} className="text-gray-700">
                        <span className="font-semibold">{pair.word}</span> → {pair.definition}{" "}
                        <span className="text-gray-400 italic">({pair.spanish})</span>
                      </p>
                    ) : null
                  )}
                </div>
              )}
            </div>
          )}

          {/* Feedback */}
          {revealed && (
            <div
              className={cn(
                "mt-4 p-3 rounded-xl text-sm font-medium animate-scale-in",
                isCorrect
                  ? "bg-green-50 text-success-600"
                  : "bg-red-50 text-danger-500"
              )}
            >
              {currentQuestion.type === "matching"
                ? isCorrect
                  ? "All pairs correct! Well done."
                  : `${Object.values(matchingResults).filter(Boolean).length} of ${matchingPairsData.length} pairs correct. Keep practicing!`
                : isCorrect
                  ? "Correct! Well done."
                  : "Not quite. Keep practicing!"}
            </div>
          )}

          {/* Action Button */}
          <div className="mt-6">
            {!revealed ? (
              <button
                onClick={checkAnswer}
                disabled={
                  currentQuestion.type === "matching"
                    ? !allMatchingPaired
                    : currentQuestion.type === "fill_blank"
                      ? !fillAnswer.trim()
                      : !selectedOption
                }
                className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Check Answer
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center gap-1"
              >
                {currentIndex + 1 >= questions.length ? "Finish" : "Next"}
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
