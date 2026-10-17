import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/DashboardHeader";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Star, Clock, BookmarkCheck, ArrowLeft } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { toast } from "sonner";

// Defines the shape of the resource object based on our DB
interface Resource {
    id: string;
    type: string;
    title: string;
    description: string;
    author: string;
    read_time?: number;
    rating?: number;
    tags?: string[];
}

export default function BookmarkedResources() {
    const navigate = useNavigate();
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [unbookmarkingId, setUnbookmarkingId] = useState<string | null>(null);

    useEffect(() => {
        fetchBookmarks();
    }, []);

    const fetchBookmarks = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/login");
            return;
        }

        // Fetch bookmarks and join with the resources table securely
        const { data, error } = await supabase
            .from("user_bookmarks")
            .select(`
        resource_id,
        resources (*)
      `)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching bookmarks:", error);
            toast.error("Failed to load bookmarks");
        } else if (data) {
            // Extract the non-null resources securely from the joint query
            const joinedResources = data
                .map(item => item.resources)
                .filter(Boolean) as Resource[];
            setResources(joinedResources);
        }
        setLoading(false);
    };

    const removeBookmark = async (resourceId: string) => {
        if (unbookmarkingId) return;
        setUnbookmarkingId(resourceId);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Optimistic UI update
        setResources(prev => prev.filter(r => r.id !== resourceId));

        try {
            const { error } = await supabase
                .from("user_bookmarks")
                .delete()
                .eq("user_id", user.id)
                .eq("resource_id", resourceId);

            if (error) throw error;
            toast.success("Bookmark removed");
        } catch (error) {
            console.error("Failed to remove bookmark", error);
            toast.error("Failed to remove bookmark");
            await fetchBookmarks(); // Re-sync the actual state
        } finally {
            setUnbookmarkingId(null);
        }
    };

    const ResourceCard = ({ resource }: { resource: Resource }) => (
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
                    onClick={() => navigate(`/resources/${resource.id}`)}
                >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Read
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeBookmark(resource.id)}
                    disabled={unbookmarkingId === resource.id}
                    className="text-primary border-primary bg-primary/5 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                    title="Remove Bookmark"
                >
                    <BookmarkCheck className="h-4 w-4" />
                </Button>
            </div>
        </Card>
    );

    return (
        <div className="min-h-screen bg-gradient-hero pb-20 flex flex-col">
            {loading ? (
                <PageLoader message="Loading bookmarks..." />
            ) : (
                <>
                    <DashboardHeader dayNumber={0} />

                    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl flex-1">
                        {/* Header / Back */}
                        <div className="space-y-4">
                            <Button
                                onClick={() => navigate("/resources")}
                                variant="ghost"
                                className="hover:bg-transparent hover:text-primary px-0 text-muted-foreground"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Resources
                            </Button>

                            <div className="flex items-center gap-3">
                                <BookmarkCheck className="h-8 w-8 text-primary" />
                                <div>
                                    <h1 className="text-3xl font-bold">Your Bookmarks</h1>
                                    <p className="text-muted-foreground">Saved educational content and success stories</p>
                                </div>
                            </div>
                        </div>

                        {/* List */}
                        {resources.length === 0 ? (
                            <Card className="p-12 text-center mt-8 border-dashed">
                                <BookmarkCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold mb-2">No bookmarks yet</h3>
                                <p className="text-muted-foreground mb-6">
                                    Save helpful articles, videos, and success stories to easily find them later.
                                </p>
                                <Button onClick={() => navigate("/resources")}>
                                    Browse Resources
                                </Button>
                            </Card>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 mt-8">
                                {resources.map((resource) => (
                                    <ResourceCard key={resource.id} resource={resource} />
                                ))}
                            </div>
                        )}
                    </div>

                    <BottomNav />
                </>
            )}
        </div>
    );
}
