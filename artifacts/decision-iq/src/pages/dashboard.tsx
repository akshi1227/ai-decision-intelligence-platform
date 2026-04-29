import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetDashboard, useCreateSession, getListSessionsQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from "recharts";
import { 
  BrainCircuit, FileText, TrendingUp, Activity, Plus, ArrowRight,
  FolderOpen, MessageSquare, Loader2, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: dashboard, isLoading } = useGetDashboard();
  const createSession = useCreateSession();

  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDomain, setNewSessionDomain] = useState("");

  const handleCreateSession = () => {
    if (!newSessionTitle.trim()) return;
    createSession.mutate({
      data: { title: newSessionTitle, domain: newSessionDomain || undefined }
    }, {
      onSuccess: (session) => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setIsNewSessionOpen(false);
        setNewSessionTitle("");
        setNewSessionDomain("");
        setLocation(`/sessions/${session.id}`);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Loading command center...</p>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-lg">
            <BrainCircuit className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Decision IQ</h1>
        </div>
        <Dialog open={isNewSessionOpen} onOpenChange={setIsNewSessionOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 font-medium shadow-sm hover-elevate">
              <Plus className="h-4 w-4" />
              New Session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Initialize Analysis Session</DialogTitle>
              <DialogDescription>
                Create a new workspace to ingest documents and run AI-driven decision analysis.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Session Title</Label>
                <Input 
                  id="title" 
                  placeholder="e.g. Q3 European Market Entry" 
                  value={newSessionTitle}
                  onChange={e => setNewSessionTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domain (Optional)</Label>
                <Input 
                  id="domain" 
                  placeholder="e.g. Strategy, Finance, M&A" 
                  value={newSessionDomain}
                  onChange={e => setNewSessionDomain(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewSessionOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateSession} disabled={createSession.isPending || !newSessionTitle.trim()}>
                {createSession.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Initialize
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Left Column: Stats & Charts */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2"><FolderOpen className="h-4 w-4"/> Sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.totalSessions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2"><FileText className="h-4 w-4"/> Documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.totalDocuments}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2"><Activity className="h-4 w-4"/> Analyses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.totalAnalyses}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2"><Sparkles className="h-4 w-4"/> Avg Confidence</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{(dashboard.avgConfidence * 100).toFixed(0)}%</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Decisions by Confidence</CardTitle>
                <CardDescription>Distribution of analysis conviction</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.decisionsByConfidence} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{fill: 'hsl(var(--muted))'}}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Document Knowledge Base</CardTitle>
                <CardDescription>Ingested sources by format</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-[250px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboard.documentsByKind}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {dashboard.documentsByKind.map((entry, index) => {
                        const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>Your active analysis workspaces</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard.recentSessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                    No sessions yet. Initialize one to start.
                  </div>
                ) : (
                  dashboard.recentSessions.map(session => (
                    <Link key={session.id} href={`/sessions/${session.id}`} className="block group">
                      <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold group-hover:text-primary transition-colors">{session.title}</h3>
                            {session.domain && <Badge variant="secondary" className="text-xs">{session.domain}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {session.documentCount} documents • {session.analysisCount} analyses • Updated {formatDistanceToNow(new Date(session.createdAt))} ago
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Activity Feed */}
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Latest intelligence events</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-[calc(100vh-16rem)] px-6">
                <div className="space-y-6 pb-6">
                  {dashboard.recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
                  ) : (
                    dashboard.recentActivity.map((activity, i) => (
                      <div key={i} className="flex gap-4 relative">
                        {i !== dashboard.recentActivity.length - 1 && (
                          <div className="absolute left-4 top-10 bottom-[-24px] w-[2px] bg-border" />
                        )}
                        <div className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center border-2 border-background">
                          {activity.kind === 'session' && <FolderOpen className="h-3.5 w-3.5 text-primary" />}
                          {activity.kind === 'document' && <FileText className="h-3.5 w-3.5 text-accent" />}
                          {activity.kind === 'analysis' && <BrainCircuit className="h-3.5 w-3.5 text-chart-3" />}
                          {activity.kind === 'chat' && <MessageSquare className="h-3.5 w-3.5 text-chart-4" />}
                        </div>
                        <div className="pt-1 pb-2">
                          <p className="text-sm font-medium leading-snug">{activity.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(activity.at))} ago</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <Link href={`/sessions/${activity.sessionId}`} className="text-xs text-primary hover:underline">
                              {activity.sessionTitle}
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
}
