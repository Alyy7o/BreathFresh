import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { BottomNav } from "@/components/BottomNav";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Edit, Plus, Info, Search, Eye } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Types
interface Specialist {
    id: string;
    name: string;
    role: string;
    experience: string; // Used as the 'About' paragraph
    location: string;
    rating: number;
    reviews_count: number;
    fee: number;
    tags: string[];
    avatar_initials: string;
    avatar_color: string;
    created_at: string;
}

const AdminSpecialists = () => {
    const [specialists, setSpecialists] = useState<Specialist[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [pageLoading, setPageLoading] = useState(true);
    const [loading, setLoading] = useState(false);

    // Modal states
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [infoSpecialist, setInfoSpecialist] = useState<Specialist | null>(null);

    const initialFormState = {
        name: '',
        role: '',
        experience: '',
        location: '',
        rating: 5.0,
        reviews_count: 0,
        fee: 0,
        tags: '',
        avatar_initials: '',
        avatar_color: 'bg-blue-500',
    };

    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        fetchSpecialists();
    }, []);

    const fetchSpecialists = async () => {
        try {
            const { data, error } = await supabase
                .from('specialists')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSpecialists(data || []);
        } catch (error: any) {
            toast.error(error.message || "Failed to load specialists");
        } finally {
            setPageLoading(false);
        }
    };

    const handleEdit = (specialist: Specialist) => {
        setEditingId(specialist.id);
        setFormData({
            name: specialist.name,
            role: specialist.role,
            experience: specialist.experience,
            location: specialist.location,
            rating: specialist.rating,
            reviews_count: specialist.reviews_count,
            fee: specialist.fee,
            tags: specialist.tags ? specialist.tags.join(', ') : '',
            avatar_initials: specialist.avatar_initials,
            avatar_color: specialist.avatar_color,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                name: formData.name,
                role: formData.role,
                experience: formData.experience,
                location: formData.location,
                rating: formData.rating,
                reviews_count: formData.reviews_count,
                fee: formData.fee,
                tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
                avatar_initials: formData.avatar_initials,
                avatar_color: formData.avatar_color,
            };

            if (editingId) {
                const { error } = await supabase.from('specialists').update(payload).eq('id', editingId);
                if (error) throw error;
                toast.success("Specialist updated successfully");
            } else {
                const { error } = await supabase.from('specialists').insert([payload]);
                if (error) throw error;
                toast.success("Specialist added successfully");
            }

            setFormData(initialFormState);
            setIsAddOpen(false);
            setEditingId(null);
            fetchSpecialists();
        } catch (error: any) {
            toast.error(error.message || "Error saving specialist");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            const { error } = await supabase.from('specialists').delete().eq('id', deletingId);
            if (error) throw error;
            toast.success("Specialist removed successfully");
            setDeletingId(null);
            fetchSpecialists();
        } catch (error: any) {
            toast.error(error.message || "Error deleting specialist");
        }
    };

    const filteredSpecialists = specialists.filter(specialist =>
        specialist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        specialist.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        specialist.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-hero pb-20">
            {pageLoading ? (
                <PageLoader message="Loading specialists directory..." />
            ) : (
                <>
                    <DashboardHeader dayNumber={1} />

                    <div className="p-4 space-y-4 max-w-7xl mx-auto">
                        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-foreground">Specialists Management</h1>
                                <p className="text-muted-foreground">Manage the directory of doctors and professionals</p>
                            </div>
                            <Button className="bg-gradient-primary" onClick={() => setIsAddOpen(true)}>
                                <Plus className="w-5 h-5 mr-2" />
                                Add Specialist
                            </Button>
                        </div>

                        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle>Directory</CardTitle>
                                    <CardDescription>Total Specialists: {specialists.length}</CardDescription>
                                </div>
                                <div className="relative w-full sm:max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name, role, or location..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Doctor</TableHead>
                                                <TableHead>Role</TableHead>
                                                <TableHead>Location</TableHead>
                                                <TableHead>Fee</TableHead>
                                                <TableHead>Rating</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredSpecialists.map((specialist) => (
                                                <TableRow key={specialist.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-9 w-9">
                                                                <AvatarFallback className={`${specialist.avatar_color} text-white text-xs`}>
                                                                    {specialist.avatar_initials}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="font-medium">{specialist.name}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{specialist.role}</TableCell>
                                                    <TableCell>{specialist.location}</TableCell>
                                                    <TableCell>Rs.{specialist.fee}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-medium">{specialist.rating}</span>
                                                            <span className="text-xs text-muted-foreground">({specialist.reviews_count})</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-none shadow-none" title="View Details" onClick={() => setInfoSpecialist(specialist)}>
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="sm" variant="outline" title="Edit" onClick={() => handleEdit(specialist)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="sm" variant="destructive" title="Delete" onClick={() => setDeletingId(specialist.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {filteredSpecialists.length === 0 && (
                                        <div className="text-center py-6 text-muted-foreground">
                                            {searchQuery ? "No specialists match your search criteria." : "No specialists found. Add one to get started."}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <BottomNav />
                </>
            )}

            {/* Add / Edit Dialog */}
            <Dialog open={isAddOpen || !!editingId} onOpenChange={(open) => {
                if (!open) {
                    setIsAddOpen(false);
                    setEditingId(null);
                    setFormData(initialFormState);
                }
            }}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Specialist' : 'Add New Specialist'}</DialogTitle>
                        <DialogDescription>
                            {editingId ? 'Update the details for this doctor.' : 'Fill in the information to add a new specialist to the directory.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Full Name e.g(Dr. Sarah Smith)</Label>
                                <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Role e.g(Addiction Specialist)</Label>
                                <Input required value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>About / Experience</Label>
                            <Textarea
                                required
                                className="h-24"
                                value={formData.experience}
                                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                                placeholder="Dr. Smith has over 15 years of experience..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Location</Label>
                                <Input required value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Consultation Fee (Rs.)</Label>
                                <Input type="number" required value={formData.fee} onChange={(e) => setFormData({ ...formData, fee: parseFloat(e.target.value) })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Initial Rating (0-5)</Label>
                                <Input type="number" step="0.1" max="5" required value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Reviews Count</Label>
                                <Input type="number" required value={formData.reviews_count} onChange={(e) => setFormData({ ...formData, reviews_count: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Avatar Initials</Label>
                                <Input required maxLength={2} value={formData.avatar_initials} onChange={(e) => setFormData({ ...formData, avatar_initials: e.target.value.toUpperCase() })} placeholder="SS" />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>Avatar Tailwind Color</Label>
                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.avatar_color}
                                    onChange={(e) => setFormData({ ...formData, avatar_color: e.target.value })}
                                >
                                    <option value="bg-blue-500">Blue</option>
                                    <option value="bg-emerald-500">Emerald</option>
                                    <option value="bg-purple-500">Purple</option>
                                    <option value="bg-amber-500">Amber</option>
                                    <option value="bg-indigo-500">Indigo</option>
                                    <option value="bg-rose-500">Rose</option>
                                    <option value="bg-slate-500">Slate</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Tags (comma separated)</Label>
                            <Input value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder="Mental Health, Addiction, Therapy" />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setIsAddOpen(false); setEditingId(null); setFormData(initialFormState); }}>Cancel</Button>
                            <Button type="submit" className="bg-gradient-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Specialist'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* About Info Dialog */}
            <Dialog open={!!infoSpecialist} onOpenChange={(open) => !open && setInfoSpecialist(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Specialist Profile</DialogTitle>
                        {/* Use visually hidden dialog description for accessibility warning fix */}
                        <DialogDescription className="sr-only">Detailed profile information for the specialist.</DialogDescription>
                    </DialogHeader>
                    {infoSpecialist && (
                        <div className="space-y-5 py-4">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarFallback className={`${infoSpecialist.avatar_color} text-white text-xl`}>
                                        {infoSpecialist.avatar_initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-bold text-lg">{infoSpecialist.name}</h3>
                                    <p className="text-muted-foreground">{infoSpecialist.role}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="font-normal border">⭐ {infoSpecialist.rating} ({infoSpecialist.reviews_count} reviews)</Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1 mt-4">
                                <h4 className="font-semibold text-sm">About</h4>
                                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed bg-muted/30 p-3 rounded-md border">{infoSpecialist.experience}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                                <div>
                                    <span className="text-muted-foreground block mb-1">Fee per session</span>
                                    <span className="font-medium bg-background border px-2 py-1 rounded-md">${infoSpecialist.fee}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block mb-1">Location</span>
                                    <span className="font-medium bg-background border px-2 py-1 rounded-md">{infoSpecialist.location}</span>
                                </div>
                            </div>

                            {infoSpecialist.tags && infoSpecialist.tags.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                    {infoSpecialist.tags.map(tag => (
                                        <Badge key={tag} variant="outline" className="bg-primary/5">{tag}</Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setInfoSpecialist(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Remove Specialist?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently remove the specialist completely from the directory.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Remove completely</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminSpecialists;
