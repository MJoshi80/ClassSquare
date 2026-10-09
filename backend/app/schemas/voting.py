from typing import List, Optional, Any, Dict
from pydantic import BaseModel

class VotingOptionItem(BaseModel):
    id: int
    option_rank: int
    score: float
    status: str
    vote_count: int
    vote_percentage: float
    is_user_vote: bool
    slot_count: int
    free_periods_count: int
    preview_summary: Optional[Dict[str, Any]] = None
    optimization_focus: Optional[str] = None
    tagline: Optional[str] = None
    top_optimized_constraints: Optional[List[Dict[str, Any]]] = None
    student_centric_points: Optional[List[Dict[str, Any]]] = None

class VotingSlateResponse(BaseModel):
    department_id: int
    department_name: str
    semester: int
    is_voting_open: bool
    approved_version_id: Optional[int] = None
    approved_option_rank: Optional[int] = None
    total_votes: int
    user_voted_option_id: Optional[int] = None
    options: List[VotingOptionItem]

class VoteCastResponse(BaseModel):
    message: str
    voted_version_id: int
    slate: VotingSlateResponse
