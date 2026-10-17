import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar, History, Clock, MapPin, Star, Video, MessageSquare, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import PageLoader from "@/components/PageLoader";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

// Database Type Definition
interface Specialist {
  id: string;
  name: string;
  role: string;
  experience: string;
  location: string;
  rating: number;
  reviews_count: number;
  fee: number;
  tags: string[];
  avatar_initials: string;
  avatar_color: string;
}

interface SpecialistReview {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

interface Appointment {
  id: string;
  user_id: string;
  specialist_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  meet_link: string;
  specialists: Specialist;
  specialist_reviews?: SpecialistReview[];
}

const ProfessionalConsultations = () => {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking State
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  // Review & Update State
  const [appointmentToUpdate, setAppointmentToUpdate] = useState<Appointment | null>(null);
  const [infoAppointment, setInfoAppointment] = useState<Appointment | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [rating, setRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Mock time slots
  const availableSlots = ["09:00 AM", "10:30 AM", "01:00 PM", "03:30 PM", "05:00 PM"];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch specialists
    const { data: specialistsData, error: specialistsError } = await supabase
      .from("specialists")
      .select("*")
      .order("created_at", { ascending: true });

    if (specialistsError) {
      console.error("Error fetching specialists:", specialistsError);
      toast.error("Failed to load specialists directory");
    } else if (specialistsData) {
      setSpecialists(specialistsData);
    }

    // Fetch user appointments
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from("appointments")
        .select(`
          *,
          specialists (*),
          specialist_reviews (*)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }); // Newest booked on top

      if (appointmentsError) {
        console.error("Error fetching appointments:", appointmentsError);
      } else if (appointmentsData) {
        // Safe mapping
        const validAppointments = appointmentsData
          .filter(a => a.specialists !== null)
          // We need to typecast because Supabase select with joins returns array or object types technically
          .map(a => ({
            ...a,
            specialists: a.specialists as unknown as Specialist,
            specialist_reviews: Array.isArray(a.specialist_reviews)
              ? (a.specialist_reviews as unknown as SpecialistReview[])
              : (a.specialist_reviews ? [a.specialist_reviews as unknown as SpecialistReview] : [])
          })) as Appointment[];
        setAppointments(validAppointments);
      }
    }

    setLoading(false);
  };

  const handleBookAppointment = async () => {
    if (!selectedSpecialist || !date || !timeSlot) return;
    setIsBooking(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to book appointments");
        return;
      }

      // Generate a mock meet link
      const randomString = Math.random().toString(36).substring(2, 12);
      const meetLink = `https://meet.google.com/mock-${randomString}`;

      const { error } = await supabase.from("appointments").insert({
        user_id: user.id,
        specialist_id: selectedSpecialist.id,
        appointment_date: format(date, "yyyy-MM-dd"),
        appointment_time: timeSlot,
        meet_link: meetLink,
        status: "confirmed"
      });

      if (error) throw error;

      toast.success("Appointment booked successfully!");
      setSelectedSpecialist(null);
      setTimeSlot(null);

      // Re-fetch to update the UI specifically for the new appointment
      fetchData();

    } catch (error) {
      console.error("Booking error:", error);
      toast.error("Failed to book appointment");
    } finally {
      setIsBooking(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!appointmentToUpdate || !updateStatus) return;
    setIsUpdating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      // 1. Update the appointment status
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ status: updateStatus })
        .eq("id", appointmentToUpdate.id);

      if (updateError) throw updateError;

      // 2. If completed and rated, insert the review
      if (updateStatus === "completed" && rating > 0) {
        const { error: reviewError } = await supabase
          .from("specialist_reviews")
          .upsert({
            appointment_id: appointmentToUpdate.id,
            user_id: user.id,
            specialist_id: appointmentToUpdate.specialist_id,
            rating: rating,
            review_text: reviewText
          }, { onConflict: "appointment_id" });

        if (reviewError) {
          console.error("Could not save review:", reviewError);
          toast.error("Status updated, but failed to save review");
        } else {
          // Calculate and update the specialist's aggregate rating
          try {
            const { data: allReviews, error: fetchReviewsError } = await supabase
              .from("specialist_reviews")
              .select("rating")
              .eq("specialist_id", appointmentToUpdate.specialist_id);

            if (!fetchReviewsError && allReviews) {
              const newCount = allReviews.length;
              const newRating = newCount > 0
                ? allReviews.reduce((acc, curr) => acc + curr.rating, 0) / newCount
                : 0;
              const roundedRating = Math.round(newRating * 10) / 10;

              await supabase
                .from("specialists")
                .update({ rating: roundedRating, reviews_count: newCount })
                .eq("id", appointmentToUpdate.specialist_id);
            }
          } catch (e) {
            console.error("Failed to update specialist aggregate rating:", e);
          }

          toast.success("Consultation completed and review saved!");
        }
      } else {
        toast.success(`Appointment marked as ${updateStatus}`);
      }

      setAppointmentToUpdate(null);
      setUpdateStatus("");
      setRating(0);
      setReviewText("");
      fetchData();

    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  // Context for dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (loading) return <PageLoader message="Loading directory..." />;

  return (
    <div className="min-h-screen bg-gradient-hero pb-32">
      <DashboardHeader dayNumber={1} />

      <div className="p-4 max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Professional Consultations</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Connect with certified specialists
          </p>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="book" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-muted/50 rounded-xl mb-6">
            <TabsTrigger value="book" className="flex items-center gap-1 sm:gap-2 py-2.5 sm:py-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Calendar className="w-4 h-4 mr-1 sm:mr-2" />
              <span>Book Provider</span>
            </TabsTrigger>
            <TabsTrigger value="consultations" className="flex items-center gap-1 sm:gap-2 py-2.5 sm:py-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <History className="w-4 h-4 mr-1 sm:mr-2" />
              <span>My Consultations</span>
            </TabsTrigger>
          </TabsList>

          {/* Book Appointment Tab */}
          <TabsContent value="book" className="space-y-4 mt-4">
            {specialists.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                No specialists available at the moment.
              </Card>
            ) : (
              specialists.map((specialist) => (
                <Card key={specialist.id} className="hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex gap-3">
                        <Avatar className="w-12 h-12 sm:w-16 sm:h-16">
                          <AvatarFallback className={`${specialist.avatar_color} text-white font-medium text-sm sm:text-xl`}>
                            {specialist.avatar_initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base flex items-center gap-2 sm:text-xl mb-1 truncate">
                            {specialist.name}
                          </CardTitle>
                          <p className="text-sm font-medium text-primary/80 mb-2">{specialist.role}</p>
                          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <span className="font-medium text-foreground">{specialist.rating}</span> ({specialist.reviews_count} reviews)
                            </span>
                            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                              <Clock className="w-3 h-3" />
                              {specialist.experience}
                            </span>
                            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                              <MapPin className="w-3 h-3" />
                              {specialist.location}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {specialist.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0 h-5 font-normal bg-secondary hover:bg-secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-gradient-primary border-0 w-fit sm:w-auto shadow-sm">Available Today</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row gap-4 sm:justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="text-muted-foreground">Next available:</span>
                        <span className="font-medium text-foreground">Next slot randomly</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <span className="text-muted-foreground">Session fee:</span>
                        <span className="font-medium text-foreground">Rs. {specialist.fee}/hr</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
                      <Button
                        onClick={() => setSelectedSpecialist(specialist)}
                        className="flex-1 bg-gradient-primary text-sm py-5 shadow-md hover:shadow-lg transition-all"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Book Video Call
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* My Consultations Tab */}
          <TabsContent value="consultations" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">My Consultations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {appointments.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 opacity-20" />
                    <p>You have no booked consultations.</p>
                  </div>
                ) : (
                  appointments.map((appointment) => {
                    const isUpcoming = new Date(appointment.appointment_date) >= today && appointment.status !== 'completed' && appointment.status !== 'cancelled';

                    return (
                      <div key={appointment.id} className="flex flex-col sm:flex-row sm:items-start gap-4 pb-5 border-b last:border-0 last:pb-0">
                        <Avatar className="w-12 h-12 flex-shrink-0">
                          <AvatarFallback className={`${appointment.specialists.avatar_color} text-white font-medium`}>
                            {appointment.specialists.avatar_initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-base truncate">{appointment.specialists.name}</h4>
                            <Badge
                              variant={appointment.status === 'confirmed' ? 'default' : appointment.status === 'cancelled' ? 'destructive' : 'outline'}
                              className={`text-xs capitalize ${appointment.status === 'confirmed' ? 'bg-gradient-primary border-0' : appointment.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-transparent' : ''}`}
                            >
                              {appointment.status}
                            </Badge>
                          </div>

                          <p className="text-sm text-muted-foreground mb-2">{appointment.specialists.role}</p>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground bg-muted/30 p-2 rounded-md mb-3">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-primary/70" />
                              <span className="font-medium text-foreground">{format(new Date(appointment.appointment_date), "MMM d, yyyy")}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-primary/70" />
                              <span className="font-medium text-foreground">{appointment.appointment_time}</span>
                            </span>
                          </div>

                          {appointment.status === 'confirmed' && (
                            <div className="text-xs mb-3">
                              <span className="text-muted-foreground">Location: </span>
                              <a href={appointment.meet_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium break-all">
                                {appointment.meet_link}
                              </a>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 mt-2">
                            {isUpcoming && (
                              <Button
                                size="sm"
                                className="bg-gradient-primary text-xs flex-1 sm:flex-none"
                                onClick={() => window.open(appointment.meet_link, '_blank')}
                              >
                                <Video className="w-3 h-3 mr-1.5" />
                                Join Meet
                              </Button>
                            )}

                            {appointment.status === 'confirmed' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs flex-1 sm:flex-none"
                                onClick={() => {
                                  setAppointmentToUpdate(appointment);
                                  setUpdateStatus("completed");
                                }}
                              >
                                Update Status
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs flex-1 sm:flex-none bg-muted hover:bg-muted/80 border-border/50 text-foreground transition-colors hover:text-primary"
                                onClick={() => setInfoAppointment(appointment)}
                              >
                                <Info className="w-3.5 h-3.5 mr-1.5 text-primary" />
                                Details & Reviews
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Booking Dialog */}
        <Dialog open={!!selectedSpecialist} onOpenChange={(open) => !open && setSelectedSpecialist(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Book Consultation</DialogTitle>
              <DialogDescription>
                Schedule a video call with {selectedSpecialist?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex justify-center border rounded-md p-2 bg-card">
                <CalendarComponent
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </div>
              <div>
                <h4 className="text-sm font-medium mb-3">Available Time Slots</h4>
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot}
                      variant={timeSlot === slot ? "default" : "outline"}
                      className={timeSlot === slot ? "bg-gradient-primary" : ""}
                      onClick={() => setTimeSlot(slot)}
                      size="sm"
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="bg-muted p-3 rounded-md mt-4">
                <p className="text-sm font-medium">Session Fee: <span className="text-primary">Rs. {selectedSpecialist?.fee}/hr</span></p>
                <p className="text-xs text-muted-foreground mt-1">Payment is handled outside the platform.</p>
              </div>
            </div>
            <DialogFooter className="sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setSelectedSpecialist(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBookAppointment}
                disabled={!date || !timeSlot || isBooking}
                className="bg-gradient-primary"
              >
                {isBooking ? "Booking..." : "Confirm Booking"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Update Status & Review Dialog */}
        <Dialog open={!!appointmentToUpdate} onOpenChange={(open) => !open && setAppointmentToUpdate(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Update Consultation Status</DialogTitle>
              <DialogDescription>
                Update the status for appointment with {appointmentToUpdate?.specialists.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div>
                <h4 className="text-sm font-medium mb-3">Status</h4>
                <div className="flex gap-2">
                  <Button
                    variant={updateStatus === "completed" ? "default" : "outline"}
                    className={updateStatus === "completed" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    onClick={() => setUpdateStatus("completed")}
                    size="sm"
                  >
                    Completed
                  </Button>
                  <Button
                    variant={updateStatus === "cancelled" ? "default" : "outline"}
                    className={updateStatus === "cancelled" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                    onClick={() => setUpdateStatus("cancelled")}
                    size="sm"
                  >
                    Cancelled
                  </Button>
                </div>
              </div>

              {updateStatus === "completed" && (
                <div className="pt-4 border-t space-y-4 animate-in fade-in zoom-in duration-300">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Rate Specialist</h4>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className="focus:outline-none transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-8 h-8 ${rating >= star
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                              }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Write a Review (Optional)</h4>
                    <Textarea
                      placeholder="How was your session? Was the specialist helpful?"
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      className="resize-none h-24"
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setAppointmentToUpdate(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateStatus}
                disabled={!updateStatus || isUpdating}
                className="bg-gradient-primary"
              >
                {isUpdating ? "Saving..." : "Save Status"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Info Dialog */}
        <Dialog open={!!infoAppointment} onOpenChange={(open) => !open && setInfoAppointment(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Consultation Information</DialogTitle>
              <DialogDescription>
                Details for your session with {infoAppointment?.specialists.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant={infoAppointment?.status === 'completed' ? 'default' : 'destructive'}
                    className={`text-xs capitalize ${infoAppointment?.status === 'completed' ? 'bg-emerald-600' : 'bg-destructive/10 text-destructive border-transparent'}`}
                  >
                    {infoAppointment?.status}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="text-sm font-medium">{infoAppointment && format(new Date(infoAppointment.appointment_date), "MMM d, yyyy")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Time</span>
                  <span className="text-sm font-medium">{infoAppointment?.appointment_time}</span>
                </div>
              </div>

              {infoAppointment?.status === 'completed' && infoAppointment.specialist_reviews && infoAppointment.specialist_reviews.length > 0 && (
                <div className="pt-4 border-t mt-2">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Your Rating & Review
                  </h4>
                  <div className="bg-muted/30 border rounded-lg p-4 space-y-4">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-5 h-5 ${infoAppointment.specialist_reviews![0].rating >= star
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/30"
                            }`}
                        />
                      ))}
                    </div>
                    {infoAppointment.specialist_reviews[0].review_text && (
                      <p className="text-sm text-foreground/90 italic bg-background p-3 rounded-md border text-left shadow-sm">
                        "{infoAppointment.specialist_reviews[0].review_text}"
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="sm:justify-end">
              <Button onClick={() => setInfoAppointment(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>

      <BottomNav />
    </div>
  );
};

export default ProfessionalConsultations;