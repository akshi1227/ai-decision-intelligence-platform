import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetSession, useAddDocument, useDeleteDocument, useRunAnalysis, 
  useSendChatMessage, getGetSessionQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, BrainCircuit, FileText, Loader2, MessageSquare, Send,
  Trash2, UploadCloud, AlertTriangle, CheckCircle2, Info, ArrowUpRight,
  ArrowDownRight, Minus, TrendingUp, Download, PieChart as PieChartIcon,
  Sparkles, FolderOpen
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// ... will split into components but let's build the monolith structure first
export default function SessionWorkspace() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();

  const { data: sessionData, isLoading } = useGetSession(id, {
    query: { enabled: !!id, queryKey: getGetSessionQueryKey(id) }
  });

  const [activeTab, setActiveTab] = useState("analysis");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Initializing workspace...</p>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl font-semibold">Session not found</h2>
        <Link href="/" className="mt-4 text-primary hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-6 w-[1px] bg-border" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">{sessionData.session.title}</h1>
            {sessionData.session.domain && (
              <p className="text-xs text-muted-foreground">{sessionData.session.domain}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs py-1">
            ID: {sessionData.session.id}
          </Badge>
          <Badge variant="secondary" className="font-mono text-xs py-1">
            {sessionData.documents.length} Docs
          </Badge>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col">
          <div className="border-b bg-muted/30 px-6">
            <TabsList className="h-12 bg-transparent space-x-2">
              <TabsTrigger value="analysis" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
                <BrainCircuit className="h-4 w-4 mr-2" /> Analysis Engine
              </TabsTrigger>
              <TabsTrigger value="documents" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
                <FileText className="h-4 w-4 mr-2" /> Documents ({sessionData.documents.length})
              </TabsTrigger>
              <TabsTrigger value="chat" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
                <MessageSquare className="h-4 w-4 mr-2" /> Session Chat
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto bg-muted/10 p-6 md:p-8">
            <TabsContent value="analysis" className="h-full m-0 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-4">
              <AnalysisPanel sessionData={sessionData} />
            </TabsContent>
            
            <TabsContent value="documents" className="h-full m-0 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-4">
              <DocumentsPanel sessionData={sessionData} />
            </TabsContent>

            <TabsContent value="chat" className="h-full m-0 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-4">
              <ChatPanel sessionData={sessionData} />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}

// ---------------------------------------------------------
// ANALYSIS PANEL
// ---------------------------------------------------------
function AnalysisPanel({ sessionData }: { sessionData: any }) {
  const queryClient = useQueryClient();
  const [focus, setFocus] = useState("");
  const runAnalysis = useRunAnalysis();
  
  const handleRun = () => {
    if (!focus.trim()) return;
    runAnalysis.mutate({
      sessionId: sessionData.session.id,
      data: { focus }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionData.session.id) });
        setFocus("");
      }
    });
  };

  const activeAnalysis = sessionData.analyses.length > 0 ? sessionData.analyses[0] : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <Card className="border-primary/20 shadow-md">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            New Analysis Run
          </CardTitle>
          <CardDescription>Deploy specialized AI agents to analyze your documents against a specific focus area.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Textarea 
              placeholder="E.g., Should we enter the European market in Q3 given the current regulatory climate?"
              value={focus}
              onChange={e => setFocus(e.target.value)}
              className="resize-none min-h-[100px] text-base"
            />
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 border-t flex justify-end py-3">
          <Button 
            onClick={handleRun} 
            disabled={runAnalysis.isPending || !focus.trim() || sessionData.documents.length === 0}
            className="w-full sm:w-auto h-12 px-8 text-md shadow-sm"
          >
            {runAnalysis.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Agents Computing...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Initialize Agents
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {sessionData.documents.length === 0 && !activeAnalysis && (
        <div className="text-center py-12 px-4 border border-dashed rounded-lg bg-card">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No documents available</h3>
          <p className="text-muted-foreground mb-4">Add documents to this session before running an analysis.</p>
        </div>
      )}

      {runAnalysis.isPending && (
        <div className="py-16 text-center space-y-6">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-2 rounded-full border-4 border-primary/40 animate-pulse" />
            <div className="absolute inset-4 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <BrainCircuit className="absolute inset-0 m-auto h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-bold">Synthesizing Intelligence</h3>
            <p className="text-muted-foreground text-sm">
              Cross-referencing {sessionData.documents.length} documents across multiple specialized agents...
            </p>
          </div>
        </div>
      )}

      {!runAnalysis.isPending && activeAnalysis && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Executive Summary & Conviction */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 shadow-sm border-l-4 border-l-primary">
              <CardHeader>
                <CardDescription className="uppercase tracking-wider font-semibold text-xs text-primary">Executive Decision</CardDescription>
                <CardTitle className="text-2xl leading-tight">{activeAnalysis.decision}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{activeAnalysis.summary}</p>
              </CardContent>
            </Card>
            
            <Card className="flex flex-col items-center justify-center text-center shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="uppercase tracking-wider font-semibold text-xs">Conviction Score</CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pb-6">
                <div className="relative inline-flex items-center justify-center w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="56" fill="transparent" stroke="hsl(var(--muted))" strokeWidth="12" />
                    <circle cx="64" cy="64" r="56" fill="transparent" stroke="hsl(var(--primary))" strokeWidth="12" strokeDasharray={351.8} strokeDashoffset={351.8 - (351.8 * activeAnalysis.confidence)} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-black">{(activeAnalysis.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Metrics */}
          {activeAnalysis.keyMetrics && activeAnalysis.keyMetrics.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Key Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {activeAnalysis.keyMetrics.map((metric: any, i: number) => (
                  <Card key={i} className="shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">{metric.label}</p>
                        <p className="text-xl font-bold">{metric.value}</p>
                      </div>
                      <div className={`p-2 rounded-full ${
                        metric.trend === 'up' ? 'bg-green-500/10 text-green-600' :
                        metric.trend === 'down' ? 'bg-red-500/10 text-red-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {metric.trend === 'up' && <TrendingUp className="h-5 w-5" />}
                        {metric.trend === 'down' && <TrendingUp className="h-5 w-5 transform rotate-180" />}
                        {metric.trend === 'flat' && <Minus className="h-5 w-5" />}
                        {metric.trend === 'unknown' && <HelpCircle className="h-5 w-5" />}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Risks & Recommendations */}
            <div className="space-y-8">
              <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {activeAnalysis.recommendations.map((rec: any, i: number) => (
                      <div key={i} className="p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-sm">{rec.title}</h4>
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                            {rec.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Risk Matrix
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {activeAnalysis.risks.map((risk: any, i: number) => (
                      <div key={i} className="p-4 hover:bg-muted/30 transition-colors">
                        <h4 className="font-semibold text-sm mb-1">{risk.title}</h4>
                        <div className="flex gap-2 mb-2">
                          <Badge variant="outline" className="text-[10px] uppercase">L: {risk.likelihood}</Badge>
                          <Badge variant="outline" className="text-[10px] uppercase">I: {risk.impact}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Mitigation:</span> {risk.mitigation}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Agents & Charts */}
            <div className="space-y-8">
              <Card className="shadow-sm border-t-4 border-t-accent">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-accent" />
                    Agent Syndicate
                  </CardTitle>
                  <CardDescription>The specialized perspectives that formed this decision.</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <Accordion type="single" collapsible className="w-full">
                    {activeAnalysis.agents.map((agent: any, i: number) => (
                      <AccordionItem value={`agent-${i}`} key={i}>
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-3 text-left">
                            <div className="bg-primary/10 p-2 rounded-md">
                              <BrainCircuit className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-semibold text-sm">{agent.name}</div>
                              <div className="text-xs text-muted-foreground font-normal">{agent.role}</div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4 text-sm">
                          <div className="bg-muted/50 p-3 rounded-md mb-3 italic border-l-2 border-primary/30 text-muted-foreground">
                            "{agent.thinking}"
                          </div>
                          <ul className="space-y-2">
                            {agent.findings.map((f: string, j: number) => (
                              <li key={j} className="flex gap-2 items-start">
                                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>

              {activeAnalysis.charts && activeAnalysis.charts.length > 0 && (
                <div className="space-y-4">
                  {activeAnalysis.charts.map((chart: any, i: number) => (
                    <Card key={i} className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{chart.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          {chart.type === 'bar' ? (
                            <BarChart data={chart.points} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                              <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                              <YAxis fontSize={10} tickLine={false} axisLine={false} />
                              <RechartsTooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderRadius: '8px'}}/>
                              <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          ) : chart.type === 'line' ? (
                            <LineChart data={chart.points} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                              <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                              <YAxis fontSize={10} tickLine={false} axisLine={false} />
                              <RechartsTooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderRadius: '8px'}}/>
                              <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-2))" strokeWidth={3} dot={{r: 4}} />
                            </LineChart>
                          ) : (
                            <PieChart>
                              <Pie data={chart.points} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={2}>
                                {chart.points.map((_: unknown, idx: number) => (
                                  <Cell key={`cell-${idx}`} fill={[`hsl(var(--chart-1))`, `hsl(var(--chart-2))`, `hsl(var(--chart-3))`, `hsl(var(--chart-4))`, `hsl(var(--chart-5))`][idx % 5]} />
                                ))}
                              </Pie>
                              <RechartsTooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderRadius: '8px'}}/>
                            </PieChart>
                          )}
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// DOCUMENTS PANEL
// ---------------------------------------------------------
function DocumentsPanel({ sessionData }: { sessionData: any }) {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [docName, setDocName] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docKind, setDocKind] = useState<"text" | "csv">("text");
  
  const addDocument = useAddDocument();
  const deleteDocument = useDeleteDocument();

  const handleAdd = () => {
    if (!docName || !docContent) return;
    addDocument.mutate({
      sessionId: sessionData.session.id,
      data: { name: docName, content: docContent, kind: docKind }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionData.session.id) });
        setIsAddOpen(false);
        setDocName("");
        setDocContent("");
      }
    });
  };

  const handleDelete = (docId: number) => {
    deleteDocument.mutate({ sessionId: sessionData.session.id, documentId: docId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionData.session.id) });
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Knowledge Base</h2>
          <p className="text-muted-foreground">Ingested sources available to the AI agents.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm"><UploadCloud className="h-4 w-4" /> Ingest Data</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Ingest New Source</DialogTitle>
              <DialogDescription>Add raw data, briefings, or reports to this session's knowledge base.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Source Name</Label>
                <Input value={docName} onChange={e => setDocName(e.target.value)} placeholder="E.g., Q2 Financials.csv or CEO Briefing" />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <div className="flex gap-2">
                  <Button variant={docKind === 'text' ? 'default' : 'outline'} onClick={() => setDocKind('text')} className="flex-1">Text / Briefing</Button>
                  <Button variant={docKind === 'csv' ? 'default' : 'outline'} onClick={() => setDocKind('csv')} className="flex-1">CSV Data</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Raw Content</Label>
                <Textarea 
                  value={docContent} 
                  onChange={e => setDocContent(e.target.value)} 
                  placeholder="Paste contents here..."
                  className="min-h-[200px] font-mono text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={addDocument.isPending || !docName || !docContent}>
                {addDocument.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Process & Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sessionData.documents.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-lg bg-card">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-1">Knowledge base is empty</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">Upload documents, data exports, or paste raw text to give the agents context for their analysis.</p>
          <Button onClick={() => setIsAddOpen(true)}>Add First Document</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessionData.documents.map((doc: any) => (
            <Card key={doc.id} className="flex flex-col shadow-sm group">
              <CardHeader className="pb-3 flex-row items-start justify-between space-y-0">
                <div>
                  <Badge variant={doc.kind === 'csv' ? 'secondary' : 'outline'} className="mb-2 uppercase text-[10px]">
                    {doc.kind}
                  </Badge>
                  <CardTitle className="text-base leading-tight font-semibold line-clamp-2" title={doc.name}>
                    {doc.name}
                  </CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity" onClick={() => handleDelete(doc.id)} disabled={deleteDocument.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {doc.summary || doc.content.substring(0, 150) + "..."}
                </p>
              </CardContent>
              <CardFooter className="pt-0 border-t bg-muted/10 mt-auto flex justify-between items-center py-3">
                <span className="text-xs text-muted-foreground font-mono">{doc.charCount.toLocaleString()} chars</span>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(doc.createdAt))} ago</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// CHAT PANEL
// ---------------------------------------------------------
function ChatPanel({ sessionData }: { sessionData: any }) {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");
  const sendMessage = useSendChatMessage();

  const handleSend = () => {
    if (!question.trim()) return;
    sendMessage.mutate({
      sessionId: sessionData.session.id,
      data: { question }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionData.session.id) });
        setQuestion("");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col border rounded-xl overflow-hidden bg-card shadow-sm">
      <div className="bg-muted/30 border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Document Q&A
          </h3>
          <p className="text-xs text-muted-foreground">Interrogate the knowledge base directly</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6 pb-4">
          {sessionData.messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-30" />
              <p className="text-muted-foreground">Ask questions about the documents in this session.</p>
            </div>
          ) : (
            sessionData.messages.map((msg: any) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-muted rounded-tl-sm border'
                }`}>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                  
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/50">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">Sources</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src: any, i: number) => (
                          <Dialog key={i}>
                            <DialogTrigger asChild>
                              <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 text-[10px] py-0.5">
                                <FileText className="h-3 w-3 mr-1" />
                                {src.documentName}
                              </Badge>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle className="text-sm flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  {src.documentName}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="bg-muted p-4 rounded-md font-mono text-xs overflow-auto max-h-[300px] whitespace-pre-wrap">
                                {src.excerpt}
                              </div>
                            </DialogContent>
                          </Dialog>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {sendMessage.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-tl-sm border p-4 max-w-[85%]">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Synthesizing answer...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 bg-card border-t">
        <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <Input 
            placeholder={sessionData.documents.length === 0 ? "Add documents first to ask questions..." : "Ask a question about the sources..."} 
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={sendMessage.isPending || sessionData.documents.length === 0}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={sendMessage.isPending || !question.trim() || sessionData.documents.length === 0}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function HelpCircle(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
}
