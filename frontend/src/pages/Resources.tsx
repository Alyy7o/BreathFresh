import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/DashboardHeader";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Video, Users, Search, Star, Clock, Bookmark, BookmarkCheck } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { toast } from "sonner";

interface Resource {
  id: string;
  type: string;
  title: string;
  description: string;
  content?: string;
  author: string;
  read_time?: number;
  rating?: number;
  tags?: string[];
  video_url?: string;
  thumbnail_url?: string;
}

export default function Resources() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState<Resource[]>([]);
  const [videos, setVideos] = useState<Resource[]>([]);
  const [successStories, setSuccessStories] = useState<Resource[]>([]);
  const [activeTab, setActiveTab] = useState("articles");
  const [pageLoading, setPageLoading] = useState(true);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching resources:", error);
      setPageLoading(false);
      return;
    }

    if (data) {
      setArticles(data.filter((r) => r.type === "article"));
      setVideos(data.filter((r) => r.type === "video"));
      setSuccessStories(data.filter((r) => r.type === "success_story"));
    }

    // Fetch bookmarks
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: bms } = await supabase
        .from("user_bookmarks")
        .select("resource_id")
        .eq("user_id", user.id);

      if (bms) {
        setBookmarkedIds(new Set(bms.map(b => b.resource_id)));
      }
    }

    setPageLoading(false);
  };

  const toggleBookmark = async (resourceId: string) => {
    if (togglingId) return;
    setTogglingId(resourceId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in to save bookmarks.");
      setTogglingId(null);
      return;
    }

    const wasBookmarked = bookmarkedIds.has(resourceId);

    // Optimistic UI
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (wasBookmarked) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });

    try {
      if (wasBookmarked) {
        await supabase
          .from("user_bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("resource_id", resourceId);
        toast.success("Removed from bookmarks");
      } else {
        await supabase
          .from("user_bookmarks")
          .insert({ user_id: user.id, resource_id: resourceId });
        toast.success("Saved to bookmarks");
      }
    } catch (error) {
      // Revert on error
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        if (wasBookmarked) next.add(resourceId);
        else next.delete(resourceId);
        return next;
      });
      toast.error("Failed to update bookmark.");
    } finally {
      setTogglingId(null);
    }
  };

  const filteredArticles = articles.filter((article) =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVideos = videos.filter((video) =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStories = successStories.filter((story) =>
    story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    story.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ResourceCard = ({ resource }: { resource: Resource }) => {
    const isBookmarked = bookmarkedIds.has(resource.id);
    const isToggling = togglingId === resource.id;

    return (
      <Card className="p-6 space-y-4 hover:shadow-lg transition-shadow">
        <div className="space-y-2">
          <h3 className="text-xl font-bold">{resource.title}</h3>
          <p className="text-muted-foreground line-clamp-2">{resource.description}</p>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {resource.read_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{resource.read_time} min read</span>
            </div>
          )}
          <span>by {resource.author}</span>
          {resource.rating && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{resource.rating}</span>
            </div>
          )}
        </div>

        {resource.tags && resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {resource.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="bg-gradient-primary text-white">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="default"
            className="flex-1 bg-gradient-primary"
            onClick={() => {
              if (resource.type === "video" && resource.video_url) {
                window.open(resource.video_url, "_blank", "noopener,noreferrer");
                return;
              }
              navigate(`/resources/${resource.id}`);
            }}
          >
            {resource.type === "video" ? (
              <>
                <Video className="h-4 w-4 mr-2" />
                Watch
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4 mr-2" />
                Read
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => toggleBookmark(resource.id)}
            disabled={isToggling}
            className={isBookmarked ? "text-primary border-primary bg-primary/5" : "text-muted-foreground"}
            title={isBookmarked ? "Remove Bookmark" : "Save Bookmark"}
          >
            {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-hero pb-20">
      {pageLoading ? (
        <PageLoader message="Loading resources..." />
      ) : (
        <>
          <DashboardHeader dayNumber={0} />

          <div className="container mx-auto px-4 py-6 space-y-6 max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">Resources</h1>
                <p className="text-muted-foreground">Educational content and expert guidance</p>
              </div>
              <Button
                variant="outline"
                className="gap-2 bg-background min-w-[140px]"
                onClick={() => navigate("/resources/bookmarks")}
              >
                <BookmarkCheck className="h-4 w-4 text-primary" />
                View Bookmarks
              </Button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search articles, videos, and success stories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="articles" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  Articles
                </TabsTrigger>
                <TabsTrigger value="videos" className="gap-2">
                  <Video className="h-4 w-4" />
                  Videos
                </TabsTrigger>
                <TabsTrigger value="stories" className="gap-2">
                  <Users className="h-4 w-4" />
                  Success Stories
                </TabsTrigger>
              </TabsList>

              <TabsContent value="articles" className="space-y-4 mt-6">
                {filteredArticles.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No articles found</p>
                  </Card>
                ) : (
                  filteredArticles.map((article) => (
                    <ResourceCard key={article.id} resource={article} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="videos" className="space-y-4 mt-6">
                {filteredVideos.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No videos found</p>
                  </Card>
                ) : (
                  filteredVideos.map((video) => (
                    <ResourceCard key={video.id} resource={video} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="stories" className="space-y-4 mt-6">
                {filteredStories.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No success stories found</p>
                  </Card>
                ) : (
                  filteredStories.map((story) => (
                    <ResourceCard key={story.id} resource={story} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>

          <BottomNav />
        </>
      )}
    </div>
  );
}
