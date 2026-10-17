import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowRight, ArrowUp, DollarSign, Trophy, Heart, Calendar, Banknote } from "lucide-react";
import brainMascot from "@/assets/brain-mascot.png";
import brainQuestion from "@/assets/brain-question.png";
import brainGraduate from "@/assets/brain-graduate.png";
import brainIdea from "@/assets/brain-idea.png";
import brainHero from "@/assets/brain-hero.png";
import brainVsCigarette from "@/assets/brain-vs-cigarette.png";
import brainCelebrate from "@/assets/brain-celebrate.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    quitReason: "",
    quitDate: "",
    yearsSmoked: "",
    cigarettesPerDay: "",
    cigarettesPerPack: "",
    packCost: "",
    enableNotifications: false,
  });

  const handleNext = async () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      // Save to database
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          toast.error("Please log in to continue");
          navigate("/login");
          return;
        }

        // First, check if profile exists, if not create it
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        let result;
        if (existingProfile) {
          // Update existing profile
          result = await supabase
            .from('profiles')
            .update({
              quit_reason: formData.quitReason,
              quit_date: formData.quitDate,
              years_smoked: parseInt(formData.yearsSmoked),
              cigarettes_per_day: parseInt(formData.cigarettesPerDay),
              cigarettes_per_pack: parseInt(formData.cigarettesPerPack),
              pack_cost: parseFloat(formData.packCost),
              enable_notifications: formData.enableNotifications,
            })
            .eq('id', user.id);
        } else {
          // Create new profile if it doesn't exist
          result = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
              quit_reason: formData.quitReason,
              quit_date: formData.quitDate,
              years_smoked: parseInt(formData.yearsSmoked),
              cigarettes_per_day: parseInt(formData.cigarettesPerDay),
              cigarettes_per_pack: parseInt(formData.cigarettesPerPack),
              pack_cost: parseFloat(formData.packCost),
              enable_notifications: formData.enableNotifications,
            });
        }

        if (result.error) {
          toast.error("Failed to save your data");
          console.error(result.error);
          return;
        }

        toast.success("Welcome to your smoke-free journey!");
        onComplete();
        navigate("/dashboard");
      } catch (error) {
        toast.error("An error occurred");
        console.error(error);
      }
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const isStepValid = () => {
    switch (step) {
      case 0: return true; // Congratulations page
      case 1: return true; // We're here to help page
      case 2: return formData.quitReason !== "";
      case 3: return formData.quitDate !== "";
      case 4: return formData.yearsSmoked !== "" && Number(formData.yearsSmoked) > 0;
      case 5: return formData.cigarettesPerDay !== "" && Number(formData.cigarettesPerDay) > 0;
      case 6: return formData.cigarettesPerPack !== "" && Number(formData.cigarettesPerPack) > 0;
      case 7: return formData.packCost !== "" && Number(formData.packCost) > 0;
      case 8: return true; // Enable notifications page
      case 9: return true; // Achievements page
      default: return false;
    }
  };

  const calculateProjections = () => {
    const packCost = Number(formData.packCost) || 0;
    const cigarettesPerPack = Number(formData.cigarettesPerPack) || 20;
    const cigarettesPerDay = Number(formData.cigarettesPerDay) || 10;
    
    const pricePerCigarette = packCost / cigarettesPerPack;
    const dailyCost = cigarettesPerDay * pricePerCigarette;
    const yearCost = dailyCost * 365;
    const cigarettesPerYear = cigarettesPerDay * 365;
    const lifeGained = Math.floor((cigarettesPerYear * 11) / 60 / 24); // 11 minutes per cigarette
    
    return {
      moneySaved: yearCost.toFixed(2),
      cigarettesNotSmoked: cigarettesPerYear,
      lifeGained: `${lifeGained}d ${Math.floor(((cigarettesPerYear * 11) / 60) % 24)}h`
    };
  };

  const projections = calculateProjections();

  const steps = [
    {
      title: "Congratulations!",
      subtitle: "Quitting smoking is one of the best decisions you have made in your life!",
      image: brainHero,
      component: (
        <div className="text-center space-y-6">
          <p className="text-muted-foreground">
            More than 5 million people worldwide have used our app. We're proud to have helped hundreds of thousands successfully quit smoking. Are you ready to be the next?
          </p>
        </div>
      ),
    },
    {
      title: "We're here to help you:",
      subtitle: "",
      image: brainVsCigarette,
      component: (
        <div className="space-y-4">
          {[
            "Quit smoking forever",
            "Track your progress",
            "Keep you motivated",
            "Get personalized insights",
            "Monitor your recovery",
            "Forget about smoking"
          ].map((benefit, index) => (
            <div key={index} className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ArrowUp className="w-5 h-5 text-primary" />
              </div>
              <span className="text-base font-medium text-foreground">{benefit}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "What is your main reason for quitting smoking?",
      subtitle: "",
      image: brainIdea,
      component: (
        <div className="space-y-3">
          <RadioGroup
            value={formData.quitReason}
            onValueChange={(value) => updateField("quitReason", value)}
            className="gap-3"
          >
            {["My health", "My family", "Better fitness", "To save money", "Having a child", "My freedom"].map((reason) => (
              <Card key={reason} className="p-4 cursor-pointer border-2 border-border bg-card hover:border-primary transition-all">
                <Label htmlFor={reason} className="flex items-center justify-between cursor-pointer">
                  <span className="text-base font-medium text-foreground">{reason}</span>
                  <RadioGroupItem value={reason} id={reason} />
                </Label>
              </Card>
            ))}
          </RadioGroup>
        </div>
      ),
    },
    {
      title: "When did you quit smoking?",
      subtitle: "Select the date and time you quit",
      image: brainQuestion,
      component: (
        <div className="space-y-4">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10" />
            <Input
              type="datetime-local"
              value={formData.quitDate}
              onChange={(e) => updateField("quitDate", e.target.value)}
              className="text-center text-lg h-14 font-medium border-2 border-border bg-card focus:border-primary transition-all pl-10"
            />
          </div>
        </div>
      ),
    },
    {
      title: "For how many years did you smoke?",
      subtitle: "",
      image: brainQuestion,
      component: (
        <div className="space-y-4">
          <Input
            type="number"
            placeholder="1"
            value={formData.yearsSmoked}
            onChange={(e) => updateField("yearsSmoked", e.target.value)}
            className="text-center text-3xl h-20 font-bold border-2 border-border bg-card focus:border-primary transition-all placeholder:text-destructive"
            min="1"
          />
        </div>
      ),
    },
    {
      title: "How many cigarettes did you smoke per day?",
      subtitle: "",
      image: brainQuestion,
      component: (
        <div className="space-y-4">
          <Input
            type="number"
            placeholder="?"
            value={formData.cigarettesPerDay}
            onChange={(e) => updateField("cigarettesPerDay", e.target.value)}
            className="text-center text-3xl h-20 font-bold border-2 border-border bg-card focus:border-primary transition-all placeholder:text-destructive"
            min="1"
          />
        </div>
      ),
    },
    {
      title: "How many cigarettes did a pack contain?",
      subtitle: "",
      image: brainQuestion,
      component: (
        <div className="space-y-4">
          <Input
            type="number"
            placeholder="?"
            value={formData.cigarettesPerPack}
            onChange={(e) => updateField("cigarettesPerPack", e.target.value)}
            className="text-center text-3xl h-20 font-bold border-2 border-border bg-card focus:border-primary transition-all placeholder:text-destructive"
            min="1"
          />
        </div>
      ),
    },
    {
      title: "How much did a pack of cigarettes cost?",
      subtitle: "",
      image: brainQuestion,
      component: (
        <div className="space-y-4">
          <div className="relative">
            <span className="absolute left-8 top-1/2 -translate-y-1/2 text-3xl font-bold text-destructive z-10">Rs.</span>
            <Input
              type="number"
              step="1"
              placeholder="?"
              value={formData.packCost}
              onChange={(e) => updateField("packCost", e.target.value)}
              className="text-center text-3xl h-20 font-bold border-2 border-border bg-card focus:border-primary transition-all pl-16 placeholder:text-destructive"
              min="0.01"
            />
          </div>
          {/* <div className="text-center">
            <select className="w-full p-3 rounded-lg border-2 border-border bg-card text-foreground font-medium">
              <option>USD - United States Dollar</option>
            </select>
          </div> */}
        </div>
      ),
    },
    {
      title: "Progress Notifications",
      subtitle: "Enable notifications to stay on track with your progress. Motivation at the right time can make a big difference. We promise not to spam!",
      image: brainCelebrate,
      component: (
        <div className="flex justify-center">
          <Button
            variant={formData.enableNotifications ? "default" : "outline"}
            onClick={() => updateField("enableNotifications", (!formData.enableNotifications).toString())}
            className="w-full h-14 text-lg font-semibold"
          >
            {formData.enableNotifications ? "Notifications Enabled ✓" : "Enable Notifications"}
          </Button>
        </div>
      ),
    },
    {
      title: "Here's what you can achieve in one year with our help",
      subtitle: "",
      image: brainGraduate,
      component: (
        <div className="space-y-4">
          <Card className="p-6 bg-card border-2 border-border flex items-center gap-4">
            <div className="w-16 h-16 bg-success/20 rounded-lg flex items-center justify-center">
              <Banknote className="w-8 h-8 text-success" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">Rs. {projections.moneySaved}</div>
              <div className="text-sm text-muted-foreground">Money saved</div>
            </div>
          </Card>
          <Card className="p-6 bg-card border-2 border-border flex items-center gap-4">
            <div className="w-16 h-16 bg-warning/20 rounded-lg flex items-center justify-center">
              <Trophy className="w-8 h-8 text-warning" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{projections.cigarettesNotSmoked}</div>
              <div className="text-sm text-muted-foreground">Cigarettes not smoked</div>
            </div>
          </Card>
          <Card className="p-6 bg-card border-2 border-border flex items-center gap-4">
            <div className="w-16 h-16 bg-destructive/20 rounded-lg flex items-center justify-center">
              <Heart className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{projections.lifeGained}</div>
              <div className="text-sm text-muted-foreground">Life expectancy gained</div>
            </div>
          </Card>
        </div>
      ),
      buttonText: "Get Started",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 flex-1 mx-1 rounded-full transition-all duration-500 ${
                  index <= step ? "bg-gradient-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Step {step + 1} of {steps.length}
          </p>
        </div>

        {/* Content */}
        <div className="animate-fade-in-up">
          <div className="text-center mb-8">
            {steps[step].image && (
              <div className="inline-flex items-center justify-center mb-6">
                <img 
                  src={steps[step].image} 
                  alt="Brain mascot" 
                  className="w-48 h-48 object-contain animate-bounce-gentle"
                />
              </div>
            )}
            <h1 className="text-2xl font-bold mb-3 px-4 text-foreground">{steps[step].title}</h1>
            {steps[step].subtitle && (
              <p className="text-muted-foreground px-6 text-sm leading-relaxed">{steps[step].subtitle}</p>
            )}
          </div>

          <div className="mb-8 px-4">{steps[step].component}</div>

          <Button
            onClick={handleNext}
            disabled={!isStepValid()}
            className="w-full h-14 text-lg font-semibold bg-gradient-primary hover:opacity-90 transition-all disabled:opacity-50"
            size="lg"
          >
            {steps[step].buttonText || (step === steps.length - 1 ? "Get Started" : "Continue")}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
