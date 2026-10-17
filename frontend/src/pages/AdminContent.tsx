import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Edit } from "lucide-react";
import PageLoader from "@/components/PageLoader";

interface Resource {
  id: string;
  type: string;
  title: string;
  description: string;
  content?: string;
  author: string;
  video_url?: string;
  thumbnail_url?: string;
  read_time?: number;
  rating?: number;
  tags?: string[];
}

const AdminContent = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    type: 'article',
    title: '',
    description: '',
    content: '',
    author: '',
    video_url: '',
    thumbnail_url: '',
    read_time: 5,
    rating: 4.5,
    tags: '',
  });

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResources(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPageLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const resourceData = {
        type: formData.type,
        title: formData.title,
        description: formData.description,
        content: formData.content || null,
        author: formData.author,
        video_url: formData.video_url || null,
        thumbnail_url: formData.thumbnail_url || null,
        read_time: formData.read_time,
        rating: formData.rating,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('resources')
          .update(resourceData)
          .eq('id', editingId);

        if (error) throw error;
        toast({ title: "Resource updated successfully!" });
      } else {
        const { error } = await supabase
          .from('resources')
          .insert([resourceData]);

        if (error) throw error;
        toast({ title: "Resource published successfully!" });
      }

      setFormData({
        type: 'article',
        title: '',
        description: '',
        content: '',
        author: '',
        video_url: '',
        thumbnail_url: '',
        read_time: 5,
        rating: 4.5,
        tags: '',
      });
      setEditingId(null);
      fetchResources();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Resource deleted successfully!" });
      fetchResources();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (resource: Resource) => {
    setEditingId(resource.id);
    setFormData({
      type: resource.type,
      title: resource.title,
      description: resource.description,
      content: resource.content || '',
      author: resource.author,
      video_url: resource.video_url || '',
      thumbnail_url: resource.thumbnail_url || '',
      read_time: resource.read_time || 5,
      rating: resource.rating || 4.5,
      tags: resource.tags?.join(', ') || '',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-hero pb-20">
      {pageLoading ? (
        <PageLoader message="Loading content management..." />
      ) : (
        <>
      <DashboardHeader dayNumber={1} />

      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Content Management</h1>
          <p className="text-muted-foreground">Create and manage articles, videos, and success stories</p>
        </div>

        <Tabs defaultValue="manage" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 bg-card/50">
            <TabsTrigger value="manage">Manage Content</TabsTrigger>
            <TabsTrigger value="create">Create Content</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle>{editingId ? 'Edit' : 'Create New'} Resource</CardTitle>
                <CardDescription>
                  {editingId ? 'Update the resource details' : 'Publish articles, videos, or success stories'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Content Type</Label>
                    <select
                      id="type"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                    >
                      <option value="article">Article</option>
                      <option value="video">Video</option>
                      <option value="success_story">Success Story</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                    />
                  </div>

                  {formData.type === 'article' && (
                    <div className="space-y-2">
                      <Label htmlFor="content">Content</Label>
                      <Textarea
                        id="content"
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        rows={8}
                      />
                    </div>
                  )}

                  {formData.type === 'video' && (
                    <div className="space-y-2">
                      <Label htmlFor="video_url">Video URL</Label>
                      <Input
                        id="video_url"
                        type="url"
                        value={formData.video_url}
                        onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="author">Author</Label>
                    <Input
                      id="author"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thumbnail_url">Thumbnail URL (optional)</Label>
                    <Input
                      id="thumbnail_url"
                      type="url"
                      value={formData.thumbnail_url}
                      onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="read_time">Read Time (minutes)</Label>
                      <Input
                        id="read_time"
                        type="number"
                        value={formData.read_time}
                        onChange={(e) => setFormData({ ...formData, read_time: parseInt(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rating">Rating (0-5)</Label>
                      <Input
                        id="rating"
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={formData.rating}
                        onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="health, motivation, tips"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading} className="flex-1">
                      {loading ? 'Publishing...' : editingId ? 'Update' : 'Publish'}
                    </Button>
                    {editingId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setFormData({
                            type: 'article',
                            title: '',
                            description: '',
                            content: '',
                            author: '',
                            video_url: '',
                            thumbnail_url: '',
                            read_time: 5,
                            rating: 4.5,
                            tags: '',
                          });
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle>Published Resources</CardTitle>
                <CardDescription>Total: {resources.length}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resources.map((resource) => (
                        <TableRow key={resource.id}>
                          <TableCell className="capitalize">{resource.type.replace('_', ' ')}</TableCell>
                          <TableCell className="font-medium">{resource.title}</TableCell>
                          <TableCell>{resource.author}</TableCell>
                          <TableCell>{resource.rating}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(resource)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(resource.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
      </>
      )}
    </div>
  );
};

export default AdminContent;
