import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/DashboardHeader";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Clock, Star, Bookmark, BookmarkCheck, ExternalLink, Video } from "lucide-react";
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
    video_url?: string | null;
    created_at: string;
}

export default function ArticleView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [resource, setResource] = useState<Resource | null>(null);
    const [loading, setLoading] = useState(true);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isToggling, setIsToggling] = useState(false);

    useEffect(() => {
        const fetchResource = async () => {
            if (!id) return;
            const { data, error } = await supabase
                .from("resources")
                .select("*")
                .eq("id", id)
                .single();

            if (error) {
                console.error("Error fetching resource:", error);
            } else {
                setResource(data);

                // Check if bookmarked
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: bm } = await supabase
                        .from("user_bookmarks")
                        .select("id")
                        .eq("user_id", user.id)
                        .eq("resource_id", id)
                        .maybeSingle();
                    if (bm) setIsBookmarked(true);
                }
            }
            setLoading(false);
        };
        fetchResource();
    }, [id]);

    const toggleBookmark = async () => {
        if (!resource || isToggling) return;
        setIsToggling(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error("Please log in to save bookmarks.");
            setIsToggling(false);
            return;
        }

        const wasBookmarked = isBookmarked;
        setIsBookmarked(!wasBookmarked); // Optimistic UI

        try {
            if (wasBookmarked) {
                await supabase
                    .from("user_bookmarks")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("resource_id", resource.id);
                toast.success("Removed from bookmarks");
            } else {
                await supabase
                    .from("user_bookmarks")
                    .insert({ user_id: user.id, resource_id: resource.id });
                toast.success("Saved to bookmarks");
            }
        } catch (error) {
            setIsBookmarked(wasBookmarked); // Revert on error
            toast.error("Failed to update bookmark.");
        } finally {
            setIsToggling(false);
        }
    };

    if (loading) return <PageLoader message="Loading article..." />;

    if (!resource) {
        return (
            <div className="min-h-screen bg-gradient-hero pb-20 flex flex-col">
                <DashboardHeader dayNumber={0} />
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                    <h2 className="text-2xl font-bold mb-4">Article Not Found</h2>
                    <Button onClick={() => navigate("/resources")} variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Resources
                    </Button>
                </div>
                <BottomNav />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-hero pb-20">
            <DashboardHeader dayNumber={0} />

            <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
                <Button
                    onClick={() => navigate("/resources")}
                    variant="ghost"
                    className="hover:bg-transparent hover:text-primary px-0 mb-2 -mt-4 text-muted-foreground"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Resources
                </Button>

                {/* Article Header */}
                <div className="space-y-4">
                    {resource.tags && resource.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {resource.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="bg-gradient-primary text-white">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    )}

                    <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-foreground">
                        {resource.title}
                    </h1>

                    <p className="text-lg text-muted-foreground leading-relaxed">
                        {resource.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 py-4 border-y border-border/50 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">By {resource.author}</span>
                        <span>•</span>
                        <span>{new Date(resource.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        {resource.read_time && (
                            <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" /> {resource.read_time} min read
                                </span>
                            </>
                        )}
                        {resource.rating && (
                            <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> {resource.rating}
                                </span>
                            </>
                        )}

                        <div className="ml-auto flex gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 rounded-full ${isBookmarked ? "text-primary" : "text-muted-foreground"}`}
                                onClick={toggleBookmark}
                                disabled={isToggling}
                                title={isBookmarked ? "Remove Bookmark" : "Save Bookmark"}
                            >
                                {isBookmarked ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                </div>

                {resource.type === "video" && resource.video_url && (
                    <Card className="p-6 sm:p-8 bg-card border-none shadow-sm space-y-4">
                        <p className="text-muted-foreground">
                            This resource opens on YouTube so you can watch the full video.
                        </p>
                        <Button
                            className="bg-gradient-primary"
                            onClick={() => window.open(resource.video_url!, "_blank", "noopener,noreferrer")}
                        >
                            <Video className="h-4 w-4 mr-2" />
                            Watch on YouTube
                            <ExternalLink className="h-4 w-4 ml-2" />
                        </Button>
                    </Card>
                )}

                {/* Article Content */}
                <Card className="p-6 sm:p-8 bg-card border-none shadow-sm text-foreground/90">
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                        {resource.content ? (
                            <div
                                className="whitespace-pre-wrap leading-relaxed text-base"
                                dangerouslySetInnerHTML={{ __html: resource.content }}
                            />
                        ) : resource.type === "video" && resource.video_url ? null : (
                            <div className="text-center py-12 text-muted-foreground italic">
                                Content for this article is not available.
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <BottomNav />
        </div>
    );
}
